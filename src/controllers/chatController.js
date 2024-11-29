const Conversation = require("../models/conversation");
const pagination = require("../utils/pagination");
const Response = require("../utils/responseHandler");
const { HttpError } = require("../utils");
const { Message } = require("../models");
const { ObjectId } = require("mongoose").Types;
const SocketResponse = require("../utils/socketHandler");
const mongoose = require("../db/mongoose");

global.io.on("connection", (socket) => {
  socket.on("conversation/user", async ({ userId }, ack) => {
    try {
      const sockets = await io.in(`conversation/user/${userId}`).fetchSockets();

      if (sockets.some((s) => s.id === socket.id)) {
        throw new Error("You are already in this conversation");
      }

      console.log(`conversation/user/${userId}`);
      await socket.join(`conversation/user/${userId}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/join", async (data, ack) => {
    try {
      const { conversationId } = data;
      const userId = socket.authUser._id;
      const parsedId = ObjectId.createFromHexString(conversationId);

      const sockets = await io
        .in(`conversation/${conversationId}`)
        .fetchSockets();

      if (sockets.some((s) => s.id === socket.id)) {
        throw new Error("You are already in this conversation");
      }

      // Check if the conversation exists
      const conversation = await Conversation.findOne({
        _id: parsedId,
        members: userId,
      });

      if (!conversation) {
        throw new Error(
          "Conversation not found or you are not a member of this conversation"
        );
      }

      if (!conversation.members.map((member) => member.id).includes(userId)) {
        throw new Error("You are not a member of this conversation");
      }

      await enterRoom(userId, conversation);
      await socket.join(`conversation/${conversation.id}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/leave", async (conversationId, ack) => {
    try {
      const sockets = await io.in(`chat/${conversationId}`).fetchSockets();

      if (!sockets.some((s) => s.id === socket.id)) {
        throw new Error("You are not in this conversation");
      }

      await socket.leave(`conversation/${conversationId}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Left conversation"));
    } catch (error) {
      return ack(SocketResponse.error(error, error.message));
    }
  });
});

exports.getMyConversations = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { q, limit, page, type } = req.query;

    const {
      skip,
      limit: parsedLimit,
      paginateResult,
    } = pagination(page, limit);

    const searchFilterQuery = q
      ? {
          $or: [
            { username: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    if (type) {
      searchFilterQuery.type = type;
    }

    try {
      const [conversations, totalConversations] = await Promise.all([
        Conversation.find({
          members: _id,
          ...searchFilterQuery,
        })
          .sort({ updatedAt: -1 })
          .limit(parsedLimit)
          .skip(skip)
          .exec(),
        Conversation.countDocuments({
          members: _id,
          ...searchFilterQuery,
        }),
      ]);

      return Response.success(
        res,
        200,
        paginateResult(totalConversations, conversations)
      );
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.sendMessageToConversation = async (req, res, next) => {
  try {
    const { content, type, receivers } = req.body;
    const { _id } = req.authUser;

    if (receivers.includes(_id)) {
      throw new HttpError(400, "You cannot send a message to yourself");
    }

    const allMembers = [...new Set([...receivers, _id])];

    let conversation = await Conversation.findOne({
      members: { $all: allMembers },
      type: allMembers.length > 2 ? "group" : "individual",
    });

    if (!conversation) {
      conversation = new Conversation({
        members: allMembers,
        type: allMembers.length > 2 ? "group" : "individual",
        lastTimeEnterChat: {
          [_id]: Date.now(),
        },
      });
    }

    const message = new Message({
      senderId: _id,
      content,
      type,
      conversationId: conversation._id,
    });
    let session = await mongoose.startSession();
    try {
      session.startTransaction();

      await conversation.save({ session });
      await message.save({ session });

      await session.commitTransaction();

      global.io
        .to(`chat/${conversation._id}`)
        .emit("conversation/newMessage", message);

      return Response.success(res, 201, message);
    } catch {
      await session.abortTransaction();
    }
  } catch (e) {
    return next(e);
  }
};

exports.getConversationDetail = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10 } = req.query;
    const { _id } = req.authUser;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    if (!conversation.members.map((member) => member.id).includes(_id)) {
      throw new HttpError(403, "You are not a member of this conversation");
    }

    const messages = await Message.find({ conversationId }).limit(limit).exec();

    return Response.success(res, 200, { ...conversation.toJSON(), messages });
  } catch (error) {
    return next(error);
  }
};

exports.getConversationByReceivers = async (req, res, next) => {
  try {
    const { receivers } = req.body;
    const { _id } = req.authUser;

    const allMembers = [...new Set([...receivers, _id])];

    const conversation = await Conversation.findOne({
      members: { $all: allMembers },
      type: allMembers.length > 2 ? "group" : "individual",
    });

    return Response.success(res, 200, conversation);
  } catch (error) {
    return next(error);
  }
};

exports.getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    const { _id } = req.authUser;

    try {
      const conversationCount = await Conversation.countDocuments({
        _id: conversationId,
        members: _id,
      });

      if (conversationCount === 0) {
        throw new HttpError(
          404,
          "Conversation not found or you are not a member of this conversation"
        );
      }

      const {
        skip,
        limit: parsedLimit,
        paginateResult,
      } = pagination(page, limit);

      const messages = await Message.find({ conversationId })
        .limit(parsedLimit)
        .skip(skip)
        .exec();
      return Response.success(
        res,
        200,
        paginateResult(messages.length, messages)
      );
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

const enterRoom = async (userId, conversation) => {
  try {
    console.log(userId, Date.now());

    if (!conversation.lastTimeEnterChat) {
      conversation.lastTimeEnterChat = {
        [userId]: Date.now(),
      };
    }

    await conversation.save();

    return conversation;
  } catch (error) {
    throw new HttpError(error.statusCode || 400, error.message, error.errors);
  }
};
