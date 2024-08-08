const { User, OTPVerification } = require("../models");
const { HttpError } = require("../utils");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const bcrypt = require("bcrypt");
const Response = require("../utils/responseHandler");
const nodemailer = require("nodemailer");
const { validationResult } = require("express-validator");
const crypto = require("crypto");

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

    const { email, password, username } = req.body;

    let existingUser = await User.findOne({ email: email }).populate("otpVerification").exec();

    if (existingUser && existingUser.isVerified) {
      throw new HttpError(400, `User with email:${email} has already exists`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const otpExpires = new Date(now + 10 * 60 * 1000); // OTP expires in 10 minutes
    const otpSentAt = new Date();
    const otpToken = crypto.randomBytes(20).toString("hex");

    const hashedPassword = await bcrypt.hash(password, 8);

    let user = existingUser;

    try {
      let otpVerification = user?.otpVerification;

      if (otpVerification) {
        if (now - new Date(otpVerification.sentAt).getTime() < OTP_COOLDOWN) {
          throw new HttpError(429, "Please wait before requesting a new OTP");
        }

        otpVerification.set({
          otp,
          expiredAt: otpExpires,
          sentAt: otpSentAt,
          otpToken,
        });
      } else {
        otpVerification = await OTPVerification({
          otp,
          expiredAt: otpExpires,
          sentAt: otpSentAt,
          otpToken,
        });
      }

      if (user) {
        user.set({
          password: hashedPassword,
          username,
          otpVerification: otpVerification._id,
        });
      } else {
        user = new User({
          email,
          password: hashedPassword,
          username,
          otpVerification: otpVerification._id,
        });
      }

      await otpVerification.save();
      await user.save();
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    const mailOptions = {
      from: process.env.EMAIL_SERVER_USER,
      to: email,
      subject: "Astrotify OTP Verification",
      html: `
        <p>Hello ${username}</p>
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
      throw new HttpError(500, error.message || "Failed to send OTP, please try again");
    }

    return Response.success(
      res,
      201,
      {
        otpToken,
        otpExpires,
      },
      "User registered successfully, please check your email for OTP verification"
    );
  } catch (error) {
    return next(error);
  }
};

exports.requestNewOtp = async (req, res, next) => {
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

    const { email } = req.body;
    const oldOTPToken = req.headers["x-otp-token"];

    let user = await User.findOne({ email: email }).populate("otpVerification").select(["-password"]).exec();

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const isUserVerified = user.isVerified;

    if (isUserVerified) {
      throw new HttpError(400, "User has already been verified, please login");
    }

    const otpVerification = user.otpVerification;

    if (!otpVerification || otpVerification.otpToken !== oldOTPToken) {
      throw new HttpError(400, "Invalid OTP token, please try to register again");
    }

    const now = Date.now();

    if (now - new Date(otpVerification.sentAt).getTime() < OTP_COOLDOWN) {
      throw new HttpError(429, "Please wait before requesting a new OTP");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
    const otpSentAt = new Date();
    const otpToken = crypto.randomBytes(20).toString("hex");

    try {
      otpVerification.set({
        otp,
        expiredAt: otpExpires,
        sentAt: otpSentAt,
        otpToken,
      });

      await otpVerification.save();

      const username = user.username;

      const mailOptions = {
        from: process.env.EMAIL_SERVER_USER,
        to: email,
        subject: "Astrotify OTP Verification",
        html: `
          <p>Hello ${username}</p>
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
        throw new HttpError(500, error.message || "Failed to send OTP, please try again");
      }

      return Response.success(
        res,
        200,
        {
          otpToken,
          otpExpires,
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

    const { email, otp } = req.body;
    const otpToken = req.headers["x-otp-token"];

    const existingUser = await User.findOne({ email }).populate("otpVerification").exec();

    if (!existingUser) {
      throw new HttpError(404, "User with email not found, please register");
    }

    const isUserVerified = existingUser.isVerified;

    if (isUserVerified) {
      throw new HttpError(400, "User has already been verified, please login");
    }

    const otpVerification = existingUser.otpVerification;

    if (new Date() > new Date(otpVerification.otpExpires)) {
      throw new HttpError(400, "OTP has expired, please request a new OTP");
    }

    if (otp !== otpVerification.otp || otpVerification.otpToken !== otpToken) {
      throw new HttpError(400, "Invalid OTP, please try again");
    }

    try {
      await OTPVerification.findByIdAndDelete(otpVerification._id).exec();
      existingUser.otpVerification = null;
      existingUser.isVerified = true;
      await existingUser.save();
    } catch (error) {
      throw new HttpError(400, error.message, error.errors);
    }

    return Response.success(res, 200, _generateAccessTokenPayload(existingUser), "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
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

    const refreshToken = req.headers["authorization"]?.split(" ")[1];

    console.log(req.headers);
    if (!refreshToken) {
      throw new HttpError(400, "Refresh token is required");
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload._id).exec();

    if (!user) {
      throw new HttpError(404, "User not found, invalid refresh token");
    }

    return Response.success(res, 200, _generateAccessTokenPayload(user));
  } catch (error) {
    return next(error);
  }
};

const _generateAccessTokenPayload = (user) => {
  const { _id, email, password } = user;
  const accessToken = generateAccessToken({ _id, email, password });
  const refreshToken = generateRefreshToken({ _id, email, password });
  const now = new Date();
  const expiresAt = new Date(now.getDate() + 2);

  return { accessToken, refreshToken, expiresAt };
};
