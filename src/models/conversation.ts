import User from "./user";
import mongoose from "../db/mongoose";
import { CallbackWithoutResultAndOptionalError } from "mongoose";

const ConversationSchema = new mongoose.Schema({
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
    enum: ["individual", "group", "channel"],
    default: "individual",
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "message",
    required: false,
  },
  lastTimeEnterChat: {
    type: Object,
    of: Date,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const _prePopulate = function (
  this: mongoose.Document,
  next: CallbackWithoutResultAndOptionalError
) {
  this?.populate([
    {
      path: "members",
      select: "username email avatar",
    },
    {
      path: "lastMessage",
    },
  ]);
  next();
};

ConversationSchema.pre("find", _prePopulate);

ConversationSchema.pre("findOne", _prePopulate);

ConversationSchema.pre("findOneAndUpdate", _prePopulate);

ConversationSchema.post("save", function (next) {
  this.updatedAt = new Date(Date.now());
});

ConversationSchema.post("findOneAndUpdate", async function () {
  this.set({ updatedAt: new Date(Date.now()) });
});

const Conversation = mongoose.model("Conversation", ConversationSchema);

export default Conversation;
