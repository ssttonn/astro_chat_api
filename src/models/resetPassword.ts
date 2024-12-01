import mongoose from "../db/mongoose";

const ResetPasswordSchema = new mongoose.Schema({
  email: String,
  resetToken: String,
  otp: {
    type: String,
    required: false,
  },
  expiredAt: Date,
  sentAt: Date,
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ResetPasswordSchema.post("save", function (next) {
  this.updatedAt = new Date(Date.now());
});

ResetPasswordSchema.post("findOneAndUpdate", async function () {
  this.set({ updatedAt: new Date(Date.now()) });
});

const ResetPassword = mongoose.model("reset_password", ResetPasswordSchema);

export default ResetPassword;
