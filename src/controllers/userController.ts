import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Types } from "mongoose";
import User from "../models/user";
import { HttpError } from "../utils";
import ResponseHandler from "../utils/responseHandler";
import pagination from "../utils/pagination";

interface SearchUsersQuery {
  q?: string;
  page?: number;
  limit?: number;
}

interface UserDetailParams {
  identifier: string;
}

export const searchUsers = async (
  req: Request<{}, {}, {}, SearchUsersQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    const {
      skip,
      limit: parsedLimit,
      paginateResult,
    } = pagination(page, limit);

    const searchFilterQuery = q
      ? {
          $or: [
            { username: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    try {
      const [users, totalUsers] = await Promise.all([
        User.find(searchFilterQuery)
          .select(["-otpVerification"])
          .skip(skip)
          .limit(parsedLimit)
          .exec(),
        User.countDocuments(searchFilterQuery),
      ]);

      return ResponseHandler.success(
        res,
        200,
        paginateResult(totalUsers, users)
      );
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

export const getUserDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { identifier } = req.params;

    let query;
    try {
      query = { _id: new Types.ObjectId(identifier) };
    } catch (error) {
      query = { username: identifier };
    }

    try {
      const user = await User.findOne(query)
        .select(["-otpVerification"])
        .exec();

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      return ResponseHandler.success(res, 200, user);
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};
