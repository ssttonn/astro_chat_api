const express = require('express');

const router = express.Router();

const chatController = require('../../controllers/chat/chatController') 

const { query } = require('express-validator');
const validationErrorsHandler = require('../../middlewares/validationErrorsHandler');

const groupChatRoutes = require('./group/groupChatRoutes')
const individualChatRoutes = require('./individual/individualChatRoutes')

router.get("/conversations", chatController.getAllConversations)

router.get("/conversation/:conversationId", chatController.getConversationDetail)

router.get("/conversation/:conversationId/messages", chatController.getConversationMessages)

router.use(express.urlencoded({ extended: true }));

router.patch("/conversation/:conversationId/messages/seen", [
    query("conversationId").not().isEmpty().withMessage("Conversation ID is required"),
], validationErrorsHandler, chatController.markMessagesAsSeen)

router.use("/conversation/group", groupChatRoutes)

router.use("/conversation/individual", individualChatRoutes)

module.exports = router