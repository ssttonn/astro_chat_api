
const mongoose = require("mongoose");

const ResetPassword = mongoose.model("reset_password", {
    email: String,
    resetToken: String,
    expiredAt: Date,
});

module.exports = ResetPassword;