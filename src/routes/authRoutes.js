const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {body, header, param} = require('express-validator');

router.use(express.urlencoded({ extended: true }));

router.post("/login", [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').not().isEmpty().withMessage('Password is required')
], authController.login);

router.post('/register/verify', [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body('email').not().isEmpty().withMessage('Email is required'),
    body('otp').not().isEmpty().withMessage('OTP is required'),
    body('email').isEmail().not().withMessage('Invalid email address'),
], authController.verifyOtp);

router.post("/register/resend-otp", [
    header("x-otp-token").not().isEmpty().withMessage("OTP token is required"),
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().not().withMessage('Invalid email address')
], authController.requestNewOtp);

router.get("/register/user-exists", authController.checkUserExists);

router.post("/register", [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').not().isEmpty().withMessage('Password is required'),
    body('username').not().isEmpty().withMessage('Username is required')
], authController.register);

router.post('/refresh-token',[
    header('authorization').not().isEmpty().withMessage('Refresh token is required')
], authController.refreshToken);

router.post('/reset-password', [
    body('email').not().isEmpty().withMessage('Email is required'),
    body('email').isEmail().withMessage('Invalid email address')
], authController.resetPassword);

module.exports = router;