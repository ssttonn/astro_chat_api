import express, { Router } from "express";
import authRoutes from "./authRoutes";
import profileRoutes from "./profileRoutes";
import userRoutes from "./userRoutes";
import chatRoutes from "./chatRoutes";
import { restAuthMiddleware } from "../middlewares/authMiddleware";

const router: Router = express.Router();

router.use("/auth", authRoutes);

router.use(restAuthMiddleware);
router.use("/profile", profileRoutes);
router.use("/user", userRoutes);
router.use("/chat", chatRoutes);

export default router;
