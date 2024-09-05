const { s3 } = require("../services/aws");
const { User } = require("../models");
const { HttpError } = require("../utils");
const Response = require("../utils/responseHandler");
const { validationResult } = require("express-validator");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const bcrypt = require("bcrypt");
const { default: mongoose } = require("mongoose");

exports.getProfile = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const me = await User.findById(_id).select(["-otpVerification"]).exec();

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    return Response.success(res, 200, me);
  } catch (error) {
    return next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
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

    const allowedUpdates = ["username"];

    const updates = Object.keys(req.body);

    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

    if (!isValidOperation) {
      throw new HttpError(400, "Invalid updates");
    }

    const { _id } = req.authUser;

    const { username } = req.body;

    const existinUsernameCount = await User.countDocuments({ username });

    if (existinUsernameCount > 0) {
      throw new HttpError(400, "Username already taken, please choose another");
    }

    const me = await User.findByIdAndUpdate(_id, req.body, { new: true })
      .select(["-otpVerification"])
      .exec();

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    return Response.success(res, 200, me);
  } catch (error) {
    return next(error);
  }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    const { _id } = req.authUser;

    if (!req.file) {
        throw new HttpError(400, "Please upload an image file");
    }

    try {
      const me = await User.findByIdAndUpdate(_id, {
        avatar: req.file.location,
      }).select(["-otpVerification"]).exec();

      if (!me) {
        throw new HttpError(404, "User not found");
      }

      me.avatar = req.file.location;

      return Response.success(res, 200, me);
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.deleteAvatar = async (req, res, next) => {
  try {
    const { _id } = req.authUser;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const me = await User.findById(_id).select(["-otpVerification"]).exec();

      if (!me) {
        throw new HttpError(404, "User not found");
      }

      const fileUrl = me.avatar;

      if (!fileUrl) {
        throw new HttpError(404, "Avatar not found, nothing to delete");
      }

      const fileParts = fileUrl.split("/");

      // Delete the avatar from S3
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileParts[fileParts.length - 2] + "/" + fileParts[fileParts.length - 1],
      });

      await s3.send(command);
      me.avatar = undefined;

      await me.save();
      
      await session.commitTransaction();
      return Response.success(res, 200, me);
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    } finally {
      session.endSession();
    }

  } catch (error) {
    return next(error);
  }
};

exports.changePassword = async (req, res, next) => {
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

    const { _id } = req.authUser;
    const { currentPassword, newPassword } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const me = await User.findById(_id).select(["-otpVerification", "+password"]).exec();

      if (!me) {
        throw new HttpError(404, "User not found, can't perform password change");
      }

      const isPasswordMatch = await bcrypt.compare(currentPassword, me.password);

      if (!isPasswordMatch) {
        throw new HttpError(400, "Current password is incorrect");
      }

      if (await bcrypt.compare(newPassword, me.password)) {
        throw new HttpError(400, "New password must be different from current password");
      }

      const newHashedPassword = await bcrypt.hash(newPassword, 8);

      me.password = newHashedPassword;

      await me.save();

      // Remove password from response
      me.password = undefined;
      
      await session.commitTransaction();
      return Response.success(res, 200, me, "Password changed successfully");
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    } finally {
      session.endSession();
    }
  } catch (error) {
    return next(error);
  }
}