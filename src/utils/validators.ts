// src/utils/validators.js
import validator from "validator";

const validatePassword = (password: string) => {
  const minLength = 8;
  const maxLength = 30;

  if (!validator.isLength(password, { min: minLength, max: maxLength })) {
    return `Password must be between ${minLength} and ${maxLength} characters.`;
  }

  if (
    !validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
  ) {
    return Error(
      "Password is not strong enough, must contain at least 1 lowercase, 1 uppercase, 1 number and 1 symbol"
    );
  }

  return null;
};

export default {
  validatePassword,
};
