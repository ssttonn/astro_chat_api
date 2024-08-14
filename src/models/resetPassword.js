
const mongoose = require("../db/mongoose");

const ResetPasswordSchema = new mongoose.Schema({
    email: String,
    resetToken: String,
    otp: {
        type: String,
        required: false
    },
    expiredAt: Date,
    sentAt: Date
});


const ResetPassword = mongoose.model("reset_password", ResetPasswordSchema);

module.exports = ResetPassword;