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
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

UserVerificationSchema.post("save", function (_) {
  this.updatedAt = Date.now();
})

UserVerificationSchema.post("findOneAndUpdate", function (_) {
  this.updatedAt = Date.now();
})

const UserVerification = mongoose.model("user_verification", UserVerificationSchema);

module.exports = UserVerification;