const HttpError = require("../../../utils/httpError");
const Response = require("../../../utils/responseHandler");
const { Message, Conversation, User } = require("../../../models");
const mongoose = require("../../../db/mongoose");

exports.createGroupConversation = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { members } = req.body;

    // Check if members array contains duplicates
    const uniqueMembers = [...new Set(members)];

    if (uniqueMembers.length !== members.length) {
      throw new HttpError(400, "Members array contains duplicates");
    }

    if (uniqueMembers.includes(_id)) {
      throw new HttpError(400, "You cannot create a conversation with yourself");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      let membersCount = await User.countDocuments({ _id: { $in: uniqueMembers } });

      if (membersCount !== uniqueMembers.length) {
        throw new HttpError(404, "One or more members not found");
      }

      let setQuery = { members: [...uniqueMembers, _id], type: "group" };

      const newConversation = await Conversation.create(setQuery);

      
      await session.commitTransaction();
      return Response.success(res, 201, await Conversation.findById(newConversation._id).exec());
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.sendNewGroupMessage = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { conversationId } = req.params;
    const { conversationType } = req.query;
    const { content, type } = req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const conversation = await Conversation.findOne({
        _id: conversationId,
        members: _id,
        type: conversationType,
      });

      if (!conversation) {
        throw new HttpError(404, "Conversation not found or you are not a member of this conversation");
      }

      const newMessage = await Message.create({
        senderId: _id,
        conversationId,
        content,
        type,
      });

      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage._id });

      if (global.io) {
        global.io.to(`conversation/${conversationId}`).emit("conversation/newMessage", newMessage);
      }

      await session.commitTransaction();
      return Response.success(res, 201, newMessage);
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.addMembersToGroup = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { conversationId } = req.params;
    const { members } = req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      let conversation = await Conversation.findOne({
        _id: conversationId,
        members: _id,
        type: "group",
      });

      if (!conversation) {
        throw new HttpError(404, "Conversation not found or you are not a member of this conversation");
      }
      conversation.members = [...conversation.members, ...members];
      await conversation.save();

      if (global.io) {
        global.io.to(`conversation/${conversationId}`).emit("conversation/membersUpdated", conversation.members);
        global.io.to(`conversation/${conversationId}`).emit("conversation/membersAdded", members);
      }
      
      await session.commitTransaction();
      return Response.success(res, 200, conversation);
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.removeMembersFromGroup = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { conversationId } = req.params;
    const { members } = req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      let conversation = await Conversation.findOne({
        _id: conversationId,
        members: _id,
        type: "group",
      });

      if (!conversation) {
        throw new HttpError(404, "Conversation not found or you are not a member of this conversation");
      }

      conversation.members = conversation.members.filter((member) => !members.includes(member));
      await conversation.save();

      if (global.io) {
        global.io.to(`conversation/${conversationId}`).emit("conversation/group/membersUpdated", conversation.members);
        global.io.to(`conversation/${conversationId}`).emit("conversation/group/membersRemoved", members);
      }

      if (conversation.members.length === 0) {
        await Conversation.findByIdAndDelete(conversationId);
      }

      await session.commitTransaction();
      return Response.success(res, 200, conversation);
    } catch (error) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
}

