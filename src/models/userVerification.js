const mongoose = require("../db/mongoose");

const UserVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: false
  }, 
  expiredAt: {
    type: Date,
    required: false
  },
  sentAt: {
    type: Date,
    required: false
  },
  token: {
    type: String,
    required: false
  }
});

const UserVerification = mongoose.model("user_verification", UserVerificationSchema);

module.exports = UserVerification;