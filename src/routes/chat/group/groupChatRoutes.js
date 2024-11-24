const express = require('express');
const { body, query, param } = require('express-validator');
const validationErrorsHandler = require('../../../middlewares/validationErrorsHandler');
const groupChatController = require('../../../controllers/chat/group/groupChatController');

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post("/", [
    body("members").isArray().withMessage("Members must be an array"),
    body("members").isLength({ min: 1 }).withMessage("At least one member are required"),
], validationErrorsHandler, groupChatController.createGroupConversation)

router.post("/:conversationId/message", [
    body("content").not().isEmpty().withMessage("Content is required"),
    body("type").not().isEmpty().withMessage("Message type is required"),
    body("type").isIn(["text", "image", "video", "audio", "emoji"]).withMessage("Invalid message type, must be text, image, video, audio or emoji"),
    param("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], validationErrorsHandler, groupChatController.sendNewGroupMessage)

router.delete("/:conversationId/leave", [
    query("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], validationErrorsHandler, groupChatController.leaveGroup)

router.patch("/:conversationId/members/add", [
    body("members").isArray().withMessage("Members must be an array"),
    body("members").isLength({ min: 1 }).withMessage("At least one member are required"),
    param("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], validationErrorsHandler, groupChatController.addMembersToGroup)

router.patch("/:conversationId/members/remove", [
    body("members").isArray().withMessage("Members must be an array"),
    body("members").isLength({ min: 1 }).withMessage("At least one member are required"),
    query("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], validationErrorsHandler, groupChatController.removeMembersFromGroup)

module.exports = router