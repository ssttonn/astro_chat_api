const express = require('express');

const router = express.Router();

const chatController = require('../controllers/chatController') 

const { body, query, param } = require('express-validator')

router.get("/conversations", chatController.getAllConversations)

router.get("/conversation/:conversationId", chatController.getConversationDetail)

router.get("/conversation/:conversationId/messages", chatController.getConversationMessages)

router.use(express.urlencoded({ extended: true }));

router.post("/conversation/group", [
    body("members").isArray().withMessage("Members must be an array"),
    body("members").isLength({ min: 1 }).withMessage("At least one member are required"),
], chatController.createGroupConversation)

router.post("/conversation/group/:conversationId/message", [
    body("content").not().isEmpty().withMessage("Content is required"),
    body("type").not().isEmpty().withMessage("Message type is required"),
    body("type").isIn(["text", "image", "video", "audio", "emoji"]).withMessage("Invalid message type, must be text, image, video, audio or emoji"),
    query("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], chatController.sendNewGroupMessage)

router.post("/conversation/individual/:receiverId/message", [
    body("content").not().isEmpty().withMessage("Content is required"),
    body("type").not().isEmpty().withMessage("Message type is required"),
    body("type").isIn(["text", "image", "video", "audio", "emoji"]).withMessage("Invalid message type, must be text, image, video, audio or emoji"),
    param("receiverId").not().isEmpty().withMessage("Receiver ID is required"),
], chatController.sendNewIndividualMessage)

router.patch("/conversation/:conversationId/messages/seen", [
    query("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], chatController.markMessagesAsSeen)

module.exports = router