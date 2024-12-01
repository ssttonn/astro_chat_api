import express from "express";
import { param } from "express-validator";
import { getUserDetail, searchUsers } from "../controllers/userController";
import validationErrorsHandler from "../middlewares/validationErrorsHandler";

const userController = {
  getUserDetail,
  searchUsers,
};

const router = express.Router();

router.get("/search", userController.searchUsers);

router.get(
  "/:identifier",
  [param("identifier").not().isEmpty().withMessage("Identifier is required")],
  validationErrorsHandler,
  userController.getUserDetail
);

export default router;
