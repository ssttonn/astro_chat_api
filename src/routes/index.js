const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const profileRoutes = require("./profileRoutes");
const authMiddleware = require('../middlewares/authMiddleware');

router.use('/auth', authRoutes);

router.use(authMiddleware)
router.use("/profile", profileRoutes)

module.exports = router;