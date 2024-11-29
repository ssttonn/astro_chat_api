const express = require("express");

const router = express.Router();

const chatController = require("../controllers/chatController");

const { query, body } = require("express-validator");
const validationErrorsHandler = require("../middlewares/validationErrorsHandler");

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

const messageValidatiors = [
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
    ...messageValidatiors,
    body("receivers").isArray().withMessage("Receiver list must be an array"),
    body("receivers")
      .isLength({ min: 1 })
      .withMessage("At least one receiver is required"),
  ],
  validationErrorsHandler,
  chatController.sendMessageToConversation
);

// router.use("/conversation/group", groupChatRoutes);

// router.use("/conversation/individual", individualChatRoutes);

module.exports = router;
