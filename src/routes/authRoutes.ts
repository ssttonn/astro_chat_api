import express, { NextFunction, Request, Response } from "express";
import {
  login,
  register,
  verifyOtp,
  requestNewOtp,
  submitUserInfo,
  checkUserExists,
  refreshToken,
  forgotPassword,
  resetPassword,
} from "../controllers/authController";

import { body, header } from "express-validator";
import validationErrorsHandler from "../middlewares/validationErrorsHandler";

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

const authController = {
  login,
  register,
  verifyOtp,
  requestNewOtp,
  submitUserInfo,
  checkUserExists,
  refreshToken,
  forgotPassword,
  resetPassword,
};

router.post(
  "/login",
  [
    body("email").not().isEmpty().withMessage("Email is required"),
    body("email").isEmail().withMessage("Invalid email address"),
    body("password").not().isEmpty().withMessage("Password is required"),
  ],
  validationErrorsHandler,
  authController.login
);

router.post(
  "/register/verify",
  [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body("email").not().isEmpty().withMessage("Email is required"),
    body("email").isEmail().not().withMessage("Invalid email address"),
    body("otp").not().isEmpty().withMessage("OTP is required"),
  ],
  validationErrorsHandler,
  authController.verifyOtp
);

router.post(
  "/register/submit-info",
  [
    body("username").not().isEmpty().withMessage("Username is required"),
    body("username").isString().withMessage("Username must be a string"),
    body("password").not().isEmpty().withMessage("Password is required"),
    body("password")
      .isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
        minLowercase: 1,
      })
      .withMessage(
        "Password must have at least 8 characters, with 1 number, 1 uppercase, 1 lowercase and 1 symbol"
      ),
  ],
  validationErrorsHandler,
  authController.submitUserInfo
);

router.post(
  "/register",
  [
    body("email").not().isEmpty().withMessage("Email is required"),
    body("email").isEmail().withMessage("Invalid email address"),
  ],
  authController.register
);

router.post(
  "/register/resend-otp",
  [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body("email").not().isEmpty().withMessage("Email is required"),
    body("email").isEmail().not().withMessage("Invalid email address"),
  ],
  validationErrorsHandler,
  authController.requestNewOtp
);

router.get("/register/user-exists", authController.checkUserExists);

router.post(
  "/refresh-token",
  [
    header("authorization")
      .not()
      .isEmpty()
      .withMessage("Refresh token is required"),
  ],
  validationErrorsHandler,
  authController.refreshToken
);

router.post(
  "/forgot-password",
  [
    body("email").not().isEmpty().withMessage("Email is required"),
    body("email").isEmail().withMessage("Invalid email address"),
  ],
  validationErrorsHandler,
  authController.forgotPassword
);

router.post(
  "/reset-password",
  [
    body("newPassword").not().isEmpty().withMessage("New password is required"),
    body("newPassword")
      .isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
        minLowercase: 1,
      })
      .withMessage(
        "New password must have at least 8 characters, with 1 number, 1 uppercase, 1 lowercase and 1 symbol"
      ),
    header("x-reset-token")
      .not()
      .isEmpty()
      .withMessage("Reset password token is required"),
  ],
  validationErrorsHandler,
  authController.resetPassword
);

export default router;
