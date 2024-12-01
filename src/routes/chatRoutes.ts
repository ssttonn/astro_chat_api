import express from "express";
import { query, body, param } from "express-validator";
import validationErrorsHandler from "../middlewares/validationErrorsHandler";
import * as chatController from "../controllers/chatController";

const router = express.Router();

router.get("/conversation/me", chatController.getMyConversations);

router.get(
  "/conversation/:conversationId",
  [
    query("conversationId")
      .not()
      .isEmpty()
      .withMessage("Conversation ID is required"),
  ],
  chatController.getConversationDetail
);

router.get(
  "/conversation/:conversationId/messages",
  chatController.getConversationMessages
);

router.use(express.urlencoded({ extended: true }));

router.post(
  "/conversation/findOne",
  [
    body("receivers").isArray().withMessage("Receiver list must be an array"),
    body("receivers")
      .isLength({ min: 1 })
      .withMessage("At least one receiver is required"),
  ],
  validationErrorsHandler,
  chatController.getConversationByReceivers
);

const messageValidators = [
  body("content").not().isEmpty().withMessage("Message content is required"),
  body("type").not().isEmpty().withMessage("Message type is required"),
  body("type")
    .isIn(["text", "image", "video", "audio", "emoji"])
    .withMessage(
      "Invalid message type, must be text, image, video, audio or emoji"
    ),
];

router.post(
  "/conversation/message",
  [
    ...messageValidators,
    body("receivers").isArray().withMessage("Receiver list must be an array"),
    body("receivers")
      .isLength({ min: 1 })
      .withMessage("At least one receiver is required"),
  ],
  validationErrorsHandler,
  chatController.sendMessageToConversation
);

router.patch(
  "/conversation/message/:messageId",
  [
    query("messageId").not().isEmpty().withMessage("Message ID is required"),
    body("content").not().isEmpty().withMessage("Message content is required"),
  ],
  chatController.editMessage
);

router.delete(
  "/conversation/message/:messageId",
  [query("messageId").not().isEmpty().withMessage("Message ID is required")],
  chatController.deleteMessage
);

// router.use("/conversation/group", groupChatRoutes);

// router.use("/conversation/individual", individualChatRoutes);

export default router;
