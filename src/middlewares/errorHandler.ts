import { Request, Response, NextFunction } from "express";
import ResponseHandler from "../utils/responseHandler";
import HttpError from "../utils/httpError";

const errorHandler = (
  err: any,
  _: Request,
  res: Response,
  __: NextFunction
) => {
  if (err instanceof HttpError) {
    return ResponseHandler.error(res, err.statusCode, err, err.toString());
  }

  return ResponseHandler.error(res, 500, err, err.toString());
};

export default errorHandler;
