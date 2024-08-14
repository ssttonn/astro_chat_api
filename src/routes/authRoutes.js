const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {body, header} = require('express-validator');

router.use(express.urlencoded({ extended: true }));

router.post("/login", [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').not().isEmpty().withMessage('Password is required')
], authController.login);

router.post('/register/verify', [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().not().withMessage('Invalid email address'),
    body('otp').not().isEmpty().withMessage('OTP is required'),
], authController.verifyOtp);

router.post("/register/submit-info", [
    body('username').not().isEmpty().withMessage('Username is required'),
    body('username').isString().withMessage('Username must be a string'),
    body('password').not().isEmpty().withMessage('Password is required'),
    body('password').isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
        minLowercase: 1
    }).withMessage("Password must have at least 8 characters, with 1 number, 1 uppercase, 1 lowercase and 1 symbol"),
], authController.submitUserInfo);

router.post("/register", [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address')
], authController.register);

router.post("/register/resend-otp", [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().not().withMessage('Invalid email address')
], authController.requestNewOtp);

router.get("/register/user-exists", authController.checkUserExists);

router.post('/refresh-token',[
    header('authorization').not().isEmpty().withMessage('Refresh token is required')
], authController.refreshToken);

router.post('/forgot-password', [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address')
], authController.forgotPassword);

router.post("/reset-password", [
    body('newPassword').not().isEmpty().withMessage('New password is required'),
    body('newPassword').isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minSymbols: 1,
        minNumbers: 1,
        minLowercase: 1
    }).withMessage("New password must have at least 8 characters, with 1 number, 1 uppercase, 1 lowercase and 1 symbol"),
    header("x-reset-token").not().isEmpty().withMessage("Reset password token is required")
], authController.resetPassword)

module.exports = router;