const { verifyAccessToken } = require("../utils/jwt");
const Response = require("../utils/responseHandler");

exports.restAuthMiddleware = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      throw new Error("Authorization header is required");
    }
    const token = authorization.split(" ")[1];
    const authUser = verifyAccessToken(token);
    req.authUser = authUser;
    next();
  } catch (error) {
    return Response.error(res, 401, undefined, "Unauthorized");
  }
};

exports.socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.headers.token;
    if (!token) {
      throw new Error("Token is required");
    }
    const authUser = verifyAccessToken(token);
    socket.authUser = authUser;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
};