const mongoose = require("../db/mongoose");
const validator = require("validator");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
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
    required: false,
    trim: true,
    minlength: 8,
    validate(value) {
      if (value.toLowerCase().includes("password")) {
        throw new Error("Password cannot contain 'password'");
      }
    },
  },
  avatar: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("user", UserSchema);

module.exports = User