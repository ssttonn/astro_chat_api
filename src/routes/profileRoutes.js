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

module.exports = router;