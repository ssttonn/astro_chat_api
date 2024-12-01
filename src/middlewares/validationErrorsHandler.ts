import { validationResult } from "express-validator";
import { HttpError } from "../utils";
import { Request, Response, NextFunction } from "express";

const validationErrorsHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new HttpError(
      400,
      errors
        .array()
        .map((error) => error.msg)
        .join(", "),
      errors.array().map((error) => error.msg)
    );
  }

  next();
};

export default validationErrorsHandler;
