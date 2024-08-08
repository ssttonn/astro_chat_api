const mongoose = require("mongoose");
const validator = require("validator");
const OTPVerification = require("./otpVerification");

const User = mongoose.model("User", {
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    validate(value) {
      if (!validator.isEmail(value)) {
        throw new Error("Email is invalid");
      }
    },
  },
  password: {
    type: String,
    required: true,
    trim: true,
    minlength: 8,
    validate(value) {
      if (value.toLowerCase().includes("password")) {
        throw new Error("Password cannot contain 'password'");
      }
    },
  },
  otpVerification: {
    type: mongoose.Schema.Types.ObjectId,
    ref: OTPVerification, 
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

module.exports = User