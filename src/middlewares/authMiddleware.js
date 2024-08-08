const { verifyAccessToken } = require("../utils/jwt");
const Response = require("../utils/responseHandler");

module.exports = (req, res, next) => {
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
