const Conversation = require("../../models/conversation");
const pagination = require("../../utils/pagination");
const Response = require("../../utils/responseHandler");
const { HttpError } = require("../../utils");
const { Message } = require("../../models");
const { ObjectId } = require("mongoose").Types;
const SocketResponse = require("../../utils/socketHandler");

global.io.on("connection", (socket) => {
  socket.on("chat/join", async (data, ack) => {
    try {
      const { conversationId } = data;
      const parsedId = ObjectId.createFromHexString(conversationId);

      const sockets = await io.in(`chat/${conversationId}`).fetchSockets();

      if (sockets.some((s) => s.id === socket.id)) {
        throw new Error("You are already in this conversation");
      }

      // Check if the conversation exists
      const conversation = await Conversation.findOne({ _id: parsedId });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      await socket.join(`chat/${conversation.id}`);

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("chat/leave", async (conversationId, ack) => {
    try {
      const sockets = await io.in(`chat/${conversationId}`).fetchSockets();

      if (!sockets.some((s) => s.id === socket.id)) {
        throw new Error("You are not in this conversation");
      }

      await socket.leave(`chat/${conversationId}`);

      return ack(SocketResponse.success(true, "Left conversation"));
    } catch (error) {
      return ack(SocketResponse.error(error, error.message));
    }
  });
});

exports.getAllConversations = async (req, res, next) => {
  try {
    const { _id } = req.authUser;
    const { q, limit, page, type } = req.query;

    const { skip, limit: parsedLimit, paginateResult } = pagination(page, limit);

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
          .limit(parsedLimit)
          .skip(skip)
          .exec(),
        Conversation.countDocuments({
          members: _id,
          ...searchFilterQuery,
        }),
      ]);

      return Response.success(res, 200, paginateResult(totalConversations, conversations));
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
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

    console.log(limit);

    const messages = await Message.find({ conversationId }).limit(limit).exec();

    return Response.success(res, 200, { ...conversation.toJSON(), messages });
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
        throw new HttpError(404, "Conversation not found or you are not a member of this conversation");
      }

      const { skip, limit: parsedLimit, paginateResult } = pagination(page, limit);

      const messages = await Message.find({ conversationId }).limit(parsedLimit).skip(skip).exec();
      return Response.success(res, 200, paginateResult(messages.length, messages));
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};


exports.markMessagesAsSeen = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { _id } = req.authUser;

    try {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        throw new HttpError(404, "Conversation not found");
      }

      if (!conversation.members.map((member) => member.id).includes(_id)) {
        throw new HttpError(403, "You are not a member of this conversation");
      }

      // Get latest message in the conversation
      const latestMessage = await Message.findOne({ conversationId }).sort({ createdAt: -1 });

      // Check if the latest message was sent by the user
      if (latestMessage.senderId.toString() === _id) {
        return Response.success(res, 200, latestMessage, "You have already seen the latest message");
      }

      // Check if the user has seen the latest message
      if (latestMessage.seenBy.includes(_id)) {
        return Response.success(res, 200, latestMessage, "You have already seen the latest message");
      }

      // Get the last message the user has seen in the conversation
      const lastSeenMessage = await Message.findOne({ conversationId, seenBy: _id }).sort({ createdAt: -1 });

      // Remove the user from the seenBy array of the last seen message
      if (lastSeenMessage && lastSeenMessage !== latestMessage) {
        lastSeenMessage.seenBy = lastSeenMessage.seenBy.filter((id) => id.toString() !== _id);
        await lastSeenMessage.save();

        // Add the user to the seenBy array of the latest message
        latestMessage.seenBy.push(_id);

        await latestMessage.save();
      }

      return Response.success(res, 200, latestMessage, "Messages marked as seen");
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};
