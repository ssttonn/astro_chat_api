import { NextFunction, Request, Response } from "express";
import { User, UserVerification } from "../models";
import { HttpError } from "../utils";
import JWTUtils from "../utils/jwt";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import crypto from "crypto";
import ResetPassword from "../models/resetPassword";
import CustomResponse from "../utils/responseHandler";

const { generateAccessToken, generateRefreshToken, verifyRefreshToken } =
  JWTUtils;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

const OTP_COOLDOWN = 60000;

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    let existingEmailCount = await User.countDocuments({
      email,
      isVerified: true,
    }).exec();

    if (existingEmailCount > 0) {
      throw new HttpError(
        400,
        `${email} has already been taken, please choose another email`
      );
    }

    let existingOtpVerification = await UserVerification.findOne({
      email,
    }).exec();

    const now = Date.now();

    if (
      existingOtpVerification &&
      existingOtpVerification.sentAt &&
      now - new Date(existingOtpVerification.sentAt).getTime() < OTP_COOLDOWN
    ) {
      throw new HttpError(429, "Please wait before requesting a new OTP");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpires = new Date(now + 10 * 60 * 1000); // OTP expires in 10 minutes
    const otpSentAt = new Date();
    const otpToken = crypto.randomBytes(20).toString("hex");

    if (!existingOtpVerification) {
      existingOtpVerification = new UserVerification({
        email,
        otp,
        expiredAt: otpExpires,
        sentAt: otpSentAt,
        token: otpToken,
      });
    } else {
      existingOtpVerification.otp = otp;
      existingOtpVerification.expiredAt = otpExpires;
      existingOtpVerification.sentAt = otpSentAt;
      existingOtpVerification.token = otpToken;
    }

    await existingOtpVerification.save();

    const findUser = await User.findOne({ email }).exec();

    if (!findUser) {
      await new User({
        email,
      }).save();
    }

    const mailOptions = {
      from: process.env.EMAIL_SERVER_USER,
      to: email,
      subject: "Astrotify OTP Verification",
      html: `
        <p>Thank you for registering with Astrotify. Please use the following OTP to verify your account:</p>
        <p>OTP: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes. If you did not register with Astrotify, please ignore this email.</p>
        <p>Best regards,</p>
        <p>Astrotify Team</p>
        <p>Notes: This is an automated email, please do not reply to this email.</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new HttpError(
        500,
        (error as any)?.message || "Failed to send OTP, please try again"
      );
    }

    return CustomResponse.success(
      res,
      201,
      {
        otpToken,
        otpExpires,
        otpRequestCooldown: OTP_COOLDOWN,
      },
      "OTP sent successfully, please check your email for OTP verification"
    );
  } catch (error) {
    return next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;
    const otpToken = req.headers["x-otp-token"] as string;

    const otpVerification = await UserVerification.findOne({
      email,
      token: otpToken,
    }).exec();

    if (!otpVerification) {
      throw new HttpError(400, "OTP token is not correct or not valid anymore");
    }

    if (otpVerification.otp !== otp) {
      throw new HttpError(400, "Invalid OTP, please try again");
    }

    if (
      otpVerification.expiredAt &&
      new Date() > new Date(otpVerification.expiredAt)
    ) {
      throw new HttpError(400, "OTP has expired, please request a new OTP");
    }

    const submitInfoToken = crypto.randomBytes(20).toString("hex");
    const submitInfoExpires = new Date(Date.now() + 10 * 60 * 1000); // Token expires in 10 minutes

    await UserVerification.findByIdAndUpdate(
      otpVerification._id || null,
      {
        token: submitInfoToken,
        sentAt: new Date(),
        expiredAt: submitInfoExpires,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return CustomResponse.success(
      res,
      200,
      {
        submitInfoToken,
        submitInfoExpires,
      },
      "OTP verified successfully, please continue to submit your information"
    );
  } catch (error) {
    return next(error);
  }
};

export const submitUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;
    const submitInfoToken = req.headers["x-info-token"] as string;

    const existingVerification = await UserVerification.findOne({
      token: submitInfoToken,
    }).exec();

    if (!existingVerification) {
      throw new HttpError(
        400,
        "Submit information token is not correct or not valid anymore"
      );
    }

    const existingUserName = await User.countDocuments({ username }).exec();

    if (existingUserName > 0) {
      throw new HttpError(
        400,
        "Username already taken, please choose another username"
      );
    }

    if (
      existingVerification.expiredAt &&
      new Date() > new Date(existingVerification.expiredAt)
    ) {
      throw new HttpError(
        400,
        "Submit information token has expired, please request a new token"
      );
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    const user = await User.findOneAndUpdate(
      { email: existingVerification.email },
      {
        username,
        password: hashedPassword,
        isVerified: true,
      },
      { new: true }
    ).exec();

    await UserVerification.findByIdAndDelete(
      existingVerification._id || null
    ).exec();

    return CustomResponse.success(
      res,
      201,
      _generateAccessTokenPayload(user),
      "User registered successfully"
    );
  } catch (error) {
    return next(error);
  }
};

export const requestNewOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const oldOTPToken = req.headers["x-otp-token"] as string;

    let otpVerification = await UserVerification.findOne({
      email,
      token: oldOTPToken,
    }).exec();

    if (!otpVerification) {
      throw new HttpError(
        400,
        "Invalid OTP token, please try to register again"
      );
    }

    const now = Date.now();

    if (
      otpVerification.sentAt &&
      now - new Date(otpVerification.sentAt).getTime() < OTP_COOLDOWN
    ) {
      throw new HttpError(429, "Please wait before requesting a new OTP");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(now + 10 * 60 * 1000); // OTP expires in 10 minutes
    const otpSentAt = new Date();
    const otpToken = crypto.randomBytes(20).toString("hex");

    await UserVerification.findByIdAndUpdate(
      otpVerification._id,
      {
        email,
        otp,
        expiredAt: otpExpires,
        sentAt: otpSentAt,
        token: otpToken,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    const mailOptions = {
      from: process.env.EMAIL_SERVER_USER,
      to: email,
      subject: "Astrotify OTP Verification",
      html: `
        <p>Thank you for registering with Astrotify. Please use the following OTP to verify your account:</p>
        <p>OTP: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes. If you did not register with Astrotify, please ignore this email.</p>
        <p>Best regards,</p>
        <p>Astrotify Team</p>
        <p>Notes: This is an automated email, please do not reply to this email.</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new HttpError(
        500,
        (error as any)?.message || "Failed to send OTP, please try again"
      );
    }

    return CustomResponse.success(
      res,
      200,
      {
        otpToken,
        otpExpires,
        otpRequestCooldown: OTP_COOLDOWN,
      },
      "OTP sent successfully, please check your email for OTP verification"
    );
  } catch (error) {
    return next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password").exec();

    if (!user || !user.isVerified || !user.password) {
      throw new HttpError(400, "User with email not found, please register");
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new HttpError(400, "Invalid credentials");
    }

    return CustomResponse.success(res, 200, _generateAccessTokenPayload(user));
  } catch (error) {
    return next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.headers["authorization"]?.split(" ")[1];

    if (!refreshToken) {
      throw new HttpError(400, "Refresh token is required");
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload._id).exec();

    if (!user) {
      throw new HttpError(404, "User not found, invalid refresh token");
    }

    return CustomResponse.success(res, 200, _generateAccessTokenPayload(user));
  } catch (error) {
    return next(error);
  }
};

export const checkUserExists = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, username } = req.query;

    if (!email && !username) {
      throw new HttpError(400, "Email or username is required");
    }

    let query: any = {};

    if (email) {
      query.email = email;
    }

    if (username) {
      query.username = username;
    }

    const existingUser = await User.findOne(query).exec();

    const isExists = (existingUser && existingUser?.isVerified) || false;

    return CustomResponse.success(res, 200, isExists);
  } catch (error) {
    return next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, method } = req.body;

    const userCount = await User.countDocuments({ email }).exec();

    if (userCount === 0) {
      throw new HttpError(404, "User not found, please register");
    }

    const resetPasswordToken = crypto.randomBytes(20).toString("hex");
    const resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // Token expires in 10 minutes
    const now = Date.now();

    const existingResetPassword = await ResetPassword.findOne({ email }).exec();

    if (
      existingResetPassword &&
      existingResetPassword?.sentAt &&
      now - existingResetPassword.sentAt.getTime() < OTP_COOLDOWN
    ) {
      throw new HttpError(
        429,
        `Please wait before requesting a new ${
          method === "otp" ? "OTP" : "reset password link"
        }`
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await ResetPassword.findOneAndUpdate(
      { email },
      {
        email,
        resetToken: crypto
          .createHash("sha256")
          .update(resetPasswordToken)
          .digest("hex"),
        expiredAt: resetPasswordExpires,
        sentAt: now,
        otp: method === "otp" ? otp : undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    const mailOptions = {
      from: process.env.EMAIL_SERVER_USER,
      to: email,
      subject: "Astrotify Password Reset",
      html: `
        <p>Hello,</p>
        <p>We received a request to reset your password. Please ${
          method === "otp" ? "use the OTP" : "click the link"
        } below to reset your password:</p>
        ${
          method === "otp"
            ? `<p>OTP: <strong>${otp}</strong></p>`
            : `<a href="${process.env.HOST}/reset-password?token=${resetPasswordToken}">Reset Password</a>`
        }
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Best regards,</p>
        <p>Astrotify Team</p>
        <p>Notes: This is an automated email, please do not reply to this email.</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new HttpError(
        500,
        (error as any)?.message ||
          "Failed to send password reset email, please try again"
      );
    }

    return CustomResponse.success(
      res,
      200,
      method === "otp"
        ? {
            resetPasswordToken,
            resetPasswordExpires,
          }
        : undefined,
      `A password reset ${
        method === "otp" ? "verification code" : "link"
      } has been sent to your email`
    );
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { newPassword, otp } = req.body;
    const resetToken = req.headers["x-reset-token"] as string;

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const query = {
      resetToken: hashedToken,
      expiredAt: { $gt: Date.now() },
    };

    const resetPassword = await ResetPassword.findOne(query)
      .select("+email")
      .exec();

    if (!resetPassword) {
      throw new HttpError(400, `Invalid or expired password reset token`);
    }

    if (otp && resetPassword.otp !== otp) {
      throw new HttpError(400, `Invalid OTP, please try again`);
    }

    const userEmail = resetPassword.email;
    const hashedPassword = await bcrypt.hash(newPassword, 8);

    await Promise.all([
      ResetPassword.findByIdAndDelete(resetPassword._id),
      User.findOneAndUpdate(
        {
          email: userEmail,
        },
        {
          password: hashedPassword,
        }
      ),
    ]);

    return CustomResponse.success(
      res,
      200,
      `Password has been reset successfully for email: ${userEmail}, please login again`
    );
  } catch (error) {
    return next(error);
  }
};

const _generateAccessTokenPayload = (user: any) => {
  const { _id, email } = user;
  const accessToken = generateAccessToken({ _id, email }, { expiresIn: "2d" });
  const refreshToken = generateRefreshToken(
    { _id, email },
    { expiresIn: "7d" }
  );
  const now = new Date();
  // 2 days after
  const accessTokenExpiryDate = new Date(
    now.getTime() + 2 * 24 * 60 * 60 * 1000
  );
  const refreshTokenExpiryDate = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ); // 7 days after

  return {
    accessToken,
    refreshToken,
    accessTokenExpiryDate,
    refreshTokenExpiryDate,
  };
};
