import express from "express";
import { body } from "express-validator";
import {
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  getProfile,
} from "../controllers/profileController";
import upload from "../middlewares/imageFileS3Multer";
import validationErrorsHandler from "../middlewares/validationErrorsHandler";

const profileController = {
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  getProfile,
};

const router = express.Router();

router.get("/me", profileController.getProfile);

router.use(express.urlencoded({ extended: true }));

router.patch(
  "/me",
  [
    body("username")
      .optional()
      .isString()
      .withMessage("Username must be a string"),
  ],
  validationErrorsHandler,
  profileController.updateProfile
);

router.put(
  "/me/avatar",
  upload.single("avatar"),
  profileController.uploadAvatar
);

router.delete("/me/avatar", profileController.deleteAvatar);

router.put(
  "/me/password",
  [
    body("currentPassword")
      .not()
      .isEmpty()
      .withMessage("Current password is required"),
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
  ],
  validationErrorsHandler,
  profileController.changePassword
);

export default router;
