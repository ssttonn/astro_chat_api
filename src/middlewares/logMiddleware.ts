import { Request, Response, NextFunction } from "express";

const logMiddleware = (req: Request, _: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

export default logMiddleware;
