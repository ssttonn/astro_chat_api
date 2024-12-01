import { Request, Response, NextFunction } from "express";
import { s3 } from "../services/aws";
import { User } from "../models";
import { CustomResponse, HttpError } from "../utils";
import ResponseHandler from "../utils/responseHandler";
import { validationResult } from "express-validator";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../models/types";

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id } = req.authUser!;
    const me = await User.findById(_id).select(["-otpVerification"]).exec();

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    return ResponseHandler.success(res, 200, me);
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest<
    {},
    {},
    {
      username: string;
    }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const allowedUpdates = ["username"];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new HttpError(400, "Invalid updates");
    }

    const { _id } = req.authUser!;
    const { username } = req.body;

    const existingUsernameCount = await User.countDocuments({ username });

    if (existingUsernameCount > 0) {
      throw new HttpError(400, "Username already taken, please choose another");
    }

    const me = await User.findByIdAndUpdate(_id, req.body, { new: true })
      .select(["-otpVerification"])
      .exec();

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    return ResponseHandler.success(res, 200, me);
  } catch (error) {
    return next(error);
  }
};

export const uploadAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id } = req.authUser!;

    if (!req.file) {
      throw new HttpError(400, "Please upload an image file");
    }

    try {
      const me = await User.findByIdAndUpdate(_id, {
        avatar: req.file.destination,
      })
        .select(["-otpVerification"])
        .exec();

      if (!me) {
        throw new HttpError(404, "User not found");
      }

      me.avatar = req.file.destination;

      return ResponseHandler.success(res, 200, me);
    } catch (error: any) {
      throw new HttpError(
        error.statusCode || 400,
        error.message || "Error uploading avatar",
        error.errors || []
      );
    }
  } catch (error) {
    return next(error);
  }
};

export const deleteAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id } = req.authUser!;

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
        Key:
          fileParts[fileParts.length - 2] +
          "/" +
          fileParts[fileParts.length - 1],
      });

      await s3.send(command);
      me.avatar = undefined;

      await me.save();

      await session.commitTransaction();
      return ResponseHandler.success(res, 200, me);
    } catch (error: any) {
      await session.abortTransaction();

      throw new HttpError(
        error.statusCode || 400,
        error.message || "Error deleting avatar",
        error.errors || []
      );
    } finally {
      session.endSession();
    }
  } catch (error) {
    return next(error);
  }
};

export const changePassword = async (
  req: AuthenticatedRequest<
    {},
    {},
    {
      currentPassword: string;
      newPassword: string;
    }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id } = req.authUser!;
    const { currentPassword, newPassword } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const me = await User.findById(_id)
        .select(["-otpVerification", "+password"])
        .exec();

      if (!me || !me.password) {
        throw new HttpError(
          404,
          "User not found, can't perform password change"
        );
      }

      const isPasswordMatch = await bcrypt.compare(
        currentPassword,
        me.password
      );

      if (!isPasswordMatch) {
        throw new HttpError(400, "Current password is incorrect");
      }

      if (await bcrypt.compare(newPassword, me.password)) {
        throw new HttpError(
          400,
          "New password must be different from current password"
        );
      }

      const newHashedPassword = await bcrypt.hash(newPassword, 8);

      me.password = newHashedPassword;

      await me.save();

      // Remove password from responselly");
      me.password = undefined;

      await session.commitTransaction();
      return ResponseHandler.success(
        res,
        200,
        me,
        "Password changed successfully"
      );
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(
        (error as any)?.statusCode || 400,
        (error as any)?.message,
        (error as any)?.errors
      );
    } finally {
      session.endSession();
    }
  } catch (error) {
    return next(error);
  }
};
