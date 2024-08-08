const mongoose = require("mongoose");

const OTPVerification = mongoose.model("otp_verification", {
  otp: String, 
  expiredAt: Date,
  sentAt: Date,
  otpToken: String,
});

module.exports = OTPVerification;