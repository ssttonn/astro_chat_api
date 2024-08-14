const express = require("express");

const router = express.Router();

const profileController = require("../controllers/profileController");

const { body, header } = require("express-validator");
const upload = require("../middlewares/imageFileS3Multer");

router.get("/me", profileController.getProfile);

router.use(express.urlencoded({ extended: true }));

router.patch("/me", [
    body("username").optional().isString().withMessage("Username must be a string"),
], profileController.updateProfile);

router.put("/me/avatar", upload.single('avatar'), profileController.uploadAvatar);

router.delete("/me/avatar", profileController.deleteAvatar);

router.put("/me/password", [
    body("currentPassword").not().isEmpty().withMessage("Current password is required"),
    body("newPassword").not().isEmpty().withMessage("New password is required"),
    body("newPassword").isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
        minLowercase: 1
    }).withMessage("New password must have at least 8 characters, with 1 number, 1 uppercase, 1 lowercase and 1 symbol"),
], profileController.changePassword);

module.exports = router;