import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { TokenPayload } from "../models/types";

dotenv.config();

const secretKey = process.env.JWT_SECRET_KEY;
const refreshTokenKey = process.env.JWT_REFRESH_TOKEN_SECRET_KEY;

const generateAccessToken = (
  payload: TokenPayload,
  options: { expiresIn: string } = { expiresIn: "2d" }
) => {
  if (!secretKey) {
    throw new Error("JWT_SECRET_KEY is not defined");
  }
  return jwt.sign(payload, secretKey, options);
};

const generateRefreshToken = (
  payload: TokenPayload,
  options = { expiresIn: "7d" }
) => {
  if (!refreshTokenKey) {
    throw new Error("JWT_REFRESH_TOKEN_SECRET_KEY is not defined");
  }
  return jwt.sign(payload, refreshTokenKey, options);
};

const verifyAccessToken = (token: string): TokenPayload => {
  if (!secretKey) {
    throw new Error("JWT_SECRET_KEY is not defined");
  }
  return JSON.parse(JSON.stringify(jwt.verify(token, secretKey)));
};

const verifyRefreshToken = (token: string): TokenPayload => {
  if (!refreshTokenKey) {
    throw new Error("JWT_REFRESH_TOKEN_SECRET_KEY is not defined");
  }
  return JSON.parse(JSON.stringify(jwt.verify(token, refreshTokenKey)));
};

const JWTUtils = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

export default JWTUtils;
