const User = require("./user");
const mongoose = require("../db/mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
      },
    ],
    name: {
      type: String,
      required: false,
    },
    thumbnail: {
      type: String,
      required: false,
    },
    type: {
      type: String,
      enum: ["individual", "group"],
      default: "individual",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }
);

  const _prePopulate = function (next) {
    this.populate([
      {
        path: "members",
        select: "username email avatar",
      },
      {
        path: "lastMessage",
      }
    ]);
    next();
  }

ConversationSchema.pre("find", _prePopulate)

ConversationSchema.pre("findOne", _prePopulate)

ConversationSchema.pre("findOneAndUpdate", _prePopulate)

ConversationSchema.post("save", function (next) {
  this.updatedAt = Date.now();
});

ConversationSchema.post("findOneAndUpdate", function (next) {
  this.updatedAt = Date.now();
})

const Conversation = mongoose.model("conversation", ConversationSchema);

module.exports = Conversation;
