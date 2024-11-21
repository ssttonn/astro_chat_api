const { User, UserVerification } = require("../models");
const { HttpError } = require("../utils");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const bcrypt = require("bcrypt");
const Response = require("../utils/responseHandler");
const nodemailer = require("nodemailer");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const ResetPassword = require("../models/resetPassword");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: process.env.EMAIL_SERVER_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

const OTP_COOLDOWN = 60000;

exports.register = async (req, res, next) => {
  try {
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
          error.message || "Failed to send OTP, please try again"
        );
      }

      return Response.success(
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
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    try {
      const { email, otp } = req.body;

      const otpToken = req.headers["x-otp-token"];

      const otpVerification = await UserVerification.findOne({
        email,
        token: otpToken,
      }).exec();

      if (!otpVerification) {
        throw new HttpError(
          400,
          "OTP token is not correct or not valid anymore"
        );
      }

      if (otpVerification.otp !== otp) {
        throw new HttpError(400, "Invalid OTP, please try again");
      }

      if (new Date() > new Date(otpVerification.expiredAt)) {
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

      return Response.success(
        res,
        200,
        {
          submitInfoToken,
          submitInfoExpires,
        },
        "OTP verified successfully, please continue to submit your information"
      );
    } catch (error) {
      throw new HttpError(400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.submitUserInfo = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(
        400,
        errors
          .array()
          .map((error) => error.msg)
          .join(", "),
        errors.array()
      );
    }

    try {
      const { username, password } = req.body;

      const submitInfoToken = req.headers["x-info-token"];

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

      if (new Date() > new Date(existingVerification.expiredAt)) {
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

      return Response.success(
        res,
        201,
        _generateAccessTokenPayload(user),
        "User registered successfully"
      );
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.requestNewOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const oldOTPToken = req.headers["x-otp-token"];

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

    if (now - new Date(otpVerification.sentAt).getTime() < OTP_COOLDOWN) {
      throw new HttpError(429, "Please wait before requesting a new OTP");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(now + 10 * 60 * 1000); // OTP expires in 10 minutes
    const otpSentAt = new Date();
    const otpToken = crypto.randomBytes(20).toString("hex");

    try {
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
          error.message || "Failed to send OTP, please try again"
        );
      }

      return Response.success(
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
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password").exec();

    if (!user || !user.isVerified) {
      throw new HttpError(400, "User with email not found, please register");
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new HttpError(400, "Invalid credentials");
    }

    return Response.success(res, 200, _generateAccessTokenPayload(user));
  } catch (error) {
    return next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.headers["authorization"]?.split(" ")[1];

    if (!refreshToken) {
      throw new HttpError(400, "Refresh token is required");
    }

    const payload = verifyRefreshToken(refreshToken);

    try {
      const user = await User.findById(payload._id).exec();

      if (!user) {
        throw new HttpError(404, "User not found, invalid refresh token");
      }

      return Response.success(res, 200, _generateAccessTokenPayload(user));
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.checkUserExists = async (req, res, next) => {
  try {
    const { email, username } = req.query;

    if (!email && !username) {
      throw new HttpError(400, "Email or username is required");
    }

    let query = {};

    if (email) {
      query.email = email;
    }

    if (username) {
      query.username = username;
    }

    const existingUser = await User.findOne(query).exec();

    const isExists = (existingUser && existingUser?.isVerified) || false;

    return Response.success(res, 200, isExists);
  } catch (error) {
    return next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
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
      now - new Date(existingResetPassword.sentAt).getTime() < OTP_COOLDOWN
    ) {
      throw new HttpError(
        429,
        `Please wait before requesting a new ${
          method === "otp" ? "OTP" : "reset password link"
        }`
      );
    }

    try {
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
          error.message ||
            "Failed to send password reset email, please try again"
        );
      }
    } catch (error) {
      throw new HttpError(400, error.message, error.errors);
    }

    return Response.success(
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

exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword, otp } = req.body;
    const resetToken = req.headers["x-reset-token"];

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const query = {
      resetToken: hashedToken,
      expiredAt: { $gt: Date.now() },
    };

    try {
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
      return Response.success(
        res,
        200,
        `Password has been reset successfully for email: ${userEmail}, please login again`
      );
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

const _generateAccessTokenPayload = (user) => {
  const { _id, email, password } = user;
  const accessToken = generateAccessToken(
    { _id, email, password },
    { expiresIn: "2d" }
  );
  const refreshToken = generateRefreshToken(
    { _id, email, password },
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
