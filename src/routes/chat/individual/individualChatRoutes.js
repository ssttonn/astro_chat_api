const express = require('express');
const { body, param } = require('express-validator');
const validationErrorsHandler = require('../../../middlewares/validationErrorsHandler');
const individualChatController = require('../../../controllers/chat/individual/individualChatController');

const router = express.Router();

router.post("/:receiverId/message", [
    body("content").not().isEmpty().withMessage("Content is required"),
    body("type").not().isEmpty().withMessage("Message type is required"),
    body("type").isIn(["text", "image", "video", "audio", "emoji"]).withMessage("Invalid message type, must be text, image, video, audio or emoji"),
    param("receiverId").not().isEmpty().withMessage("Receiver ID is required"),
], validationErrorsHandler, individualChatController.sendNewIndividualMessage)

module.exports = router