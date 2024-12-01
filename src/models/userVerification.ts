import mongoose from "../db/mongoose";

const UserVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: false,
  },
  expiredAt: {
    type: Date,
    required: false,
  },
  sentAt: {
    type: Date,
    required: false,
  },
  token: {
    type: String,
    required: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

UserVerificationSchema.post("save", function () {
  this.updatedAt = new Date(Date.now());
});

UserVerificationSchema.post("findOneAndUpdate", async function () {
  this.set({ updatedAt: new Date(Date.now()) });
});

const UserVerification = mongoose.model(
  "user_verification",
  UserVerificationSchema
);

export default UserVerification;
