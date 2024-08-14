const { s3 } = require("../services/aws");
const { User } = require("../models");
const { HttpError } = require("../utils");
const Response = require("../utils/responseHandler");
const { validationResult } = require("express-validator");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const bcrypt = require("bcrypt");

exports.getProfile = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const me = await User.findById(_id).select(["-password", "-otpVerification"]).exec();

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
      .select(["-password", "-otpVerification"])
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

    const me = await User.findById(_id).select(["-password", "-otpVerification"]).exec();

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    if (!req.file) {
        throw new HttpError(400, "Please upload an image file");
    }

    me.avatar = req.file.location;

    try {
      await me.save();
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    return Response.success(res, 200, me);
  } catch (error) {
    return next(error);
  }
};

exports.deleteAvatar = async (req, res, next) => {
  try {
    const { _id } = req.authUser;

    const me = await User.findById(_id).select(["-password", "-otpVerification"]).exec();

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

    try {
      await s3.send(command);
    } catch (error) {
      throw new HttpError(500, error.message, error.errors);
    }
    me.avatar = undefined;

    try {
      await me.save();
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    return Response.success(res, 200, me);
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


    try {
      const me = await User.findById(_id).select("-otpVerification").exec();

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

      return Response.success(res, 200, me, "Password changed successfully");
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
}