const User = require("../models/user");
const { HttpError } = require("../utils");
const Response = require("../utils/responseHandler");
const pagination = require("../utils/pagination");
const { ObjectId } = require("mongoose").Types;
const { validationResult } = require("express-validator");

exports.searchUsers = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    const { skip, limit: parsedLimit, paginateResult } = pagination(page, limit);

    const searchFilterQuery = q
      ? {
          $or: [{ username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }],
        }
      : {};

    try {
      const users = await User.find(searchFilterQuery)
        .select(["-password", "-otpVerification"])
        .skip(skip)
        .limit(parsedLimit)
        .exec();

      const totalUsers = await User.countDocuments(searchFilterQuery);

      return Response.success(res, 200, paginateResult(totalUsers, users));
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.userDetail = async (req, res, next) => {
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
    // Could be username or _id
    const { identifier } = req.params;

    let query;
    try {
        query = { _id: ObjectId.createFromHexString(identifier) };
    } catch (error) {
        query = { username: identifier };
    }   

    try {
      const user = await User.findOne(query).select(["-password", "-otpVerification"]).exec();

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      return Response.success(res, 200, user);
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};