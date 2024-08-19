const mongoose = require("../db/mongoose");
const Conversation = require("./conversation");

const MessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: Conversation
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["text", "image", "file", "audio", "video", "emoji"],
        default: "text"
    },
    level: {
        type: Number,
        default: 0,
    },
    taggedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ],
    replies: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "message"
        }
    ],
    seenBy: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model("message", MessageSchema);

module.exports = Message;