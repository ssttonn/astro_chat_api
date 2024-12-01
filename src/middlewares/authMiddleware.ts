import { AuthenticatedRequest, AuthenticatedSocket } from "../models/types";
import JWTUtils from "../utils/jwt";
import CustomResponse from "../utils/responseHandler";
import { Response, NextFunction } from "express";

export const restAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      throw new Error("Authorization header is required");
    }
    const token = authorization.split(" ")[1];
    const authUser = JWTUtils.verifyAccessToken(token);
    req.authUser = authUser;
    next();
  } catch (error) {
    return CustomResponse.error(res, 401, undefined, "Unauthorized");
  }
};

export const socketAuthMiddleware = (
  socket: AuthenticatedSocket,
  next: (error?: any) => void
) => {
  try {
    const token = socket.handshake.headers.token;
    if (!token || !(token instanceof String)) {
      throw new Error("Token is required");
    }
    const authUser = JWTUtils.verifyAccessToken(token as string);
    socket.authUser = authUser;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
};
