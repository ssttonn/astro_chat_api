const { validationResult } = require("express-validator");
const { HttpError } = require("../utils");

module.exports = (req, _, next) => {
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
  
    next();
}