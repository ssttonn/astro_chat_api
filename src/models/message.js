const mongoose = require("../db/mongoose");
const Conversation = require("./conversation");

const MessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: Conversation,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user",
        index: true
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
            ref: "user",
            index: true
        }
    ],
    replies: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "message",
            index: true
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

const _prePopulate = function (next) {
    this.populate([
        {
            path: "replies",
        },
        {
            path: "senderId",
            select: "username email avatar",
        },
        {
            path: "taggedUsers",
            select: "username email avatar",
        }
    ]);
    next();
}
    

MessageSchema.pre("find", _prePopulate);

MessageSchema.pre("findOne", _prePopulate);

MessageSchema.pre("findOneAndUpdate", _prePopulate);

MessageSchema.post("save", function (next) {
    this.updatedAt = Date.now();
});

MessageSchema.post("findOneAndUpdate", function (next) {
    this.updatedAt = Date.now();
})

const Message = mongoose.model("message", MessageSchema);

module.exports = Message;