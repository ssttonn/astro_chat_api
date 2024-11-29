const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const userRoutes = require("./userRoutes");
const chatRoutes = require("./chatRoutes");

const { restAuthMiddleware } = require("../middlewares/authMiddleware");

router.use("/auth", authRoutes);

router.use(restAuthMiddleware);
router.use("/profile", profileRoutes);
router.use("/user", userRoutes);
router.use("/chat", chatRoutes);

module.exports = router;
