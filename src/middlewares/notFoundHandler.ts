import { Request, Response, NextFunction } from "express";
import HttpError from "../utils/httpError";

const notFoundHandler = (req: Request, _: Response, next: NextFunction) => {
  const { method, url } = req;
  return next(
    new HttpError(404, `Can't ${method} into ${url}, route not Found`)
  );
};

export default notFoundHandler;
