
const mongoose = require("../db/mongoose");

const ResetPasswordSchema = new mongoose.Schema({
    email: String,
    resetToken: String,
    otp: {
        type: String,
        required: false
    },
    expiredAt: Date,
    sentAt: Date,
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ResetPasswordSchema.post("save", function (next) {
    this.updatedAt = Date.now();
});

ResetPasswordSchema.post("findOneAndUpdate", function (next) {
    this.updatedAt = Date.now();
})

const ResetPassword = mongoose.model("reset_password", ResetPasswordSchema);

module.exports = ResetPassword;