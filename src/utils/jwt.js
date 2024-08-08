const jwt = require("jsonwebtoken");
require("dotenv").config();

const secretKey = process.env.JWT_SECRET_KEY;
const refreshTokenKey = process.env.JWT_REFRESH_TOKEN_SECRET_KEY;

exports.generateAccessToken = (payload, options = { expiresIn: "2d" }) => {
  return jwt.sign(payload, secretKey, options);
};

exports.generateRefreshToken = (payload, options = { expiresIn: "7d" }) => {
  return jwt.sign(payload, refreshTokenKey, options);
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, secretKey);
};

exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, refreshTokenKey);
};
