import { NextFunction, Response } from "express";
import mongoose from "../db/mongoose";
import { User } from "../models";
import Conversation from "../models/conversation";
import Message from "../models/message";
import {
  AuthenticatedRequest,
  AuthenticatedSocket,
  PaginationRequest,
} from "../models/types";
import { getSocketInstance } from "../services/socketIOClient";
import { CustomResponse, HttpError } from "../utils";
import pagination from "../utils/pagination";
import ResponseHandler from "../utils/responseHandler";
import SocketResponse from "../utils/socketHandler";
import { Types } from "mongoose";

const io = getSocketInstance();

io.on("connection", (socket: AuthenticatedSocket) => {
  socket.on("conversationList/user", async (_, ack) => {
    try {
      const { _id } = socket.authUser!;
      socket.leave(`conversationList/user/${_id}`);
      console.log(`conversationList/user/${_id}`);
      await socket.join(`conversationList/user/${_id}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Listened to conversation list"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/join", async (data, ack) => {
    try {
      const { conversationId } = data;
      const { _id } = socket.authUser!;
      const parsedId = Types.ObjectId.createFromHexString(conversationId);

      const conversation = await Conversation.findOne({
        _id: parsedId,
        members: _id,
      });

      if (!conversation) {
        throw new Error(
          "Conversation not found or you are not a member of this conversation"
        );
      }

      await socket.join(`conversation/${conversation.id}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/seen", async (data, ack) => {
    try {
      const { conversationId } = data;
      const { _id } = socket.authUser!;

      const seenAt = await markMessagesAsSeen(conversationId, _id);

      socket.to(`conversation/${conversationId}`).emit("conversation/seen", {
        userId: _id,
        seenAt,
      });

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Marked messages as seen"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/typing", async (data, ack) => {
    try {
      const { conversationId, isTyping } = data;
      const { _id } = socket.authUser!;

      socket.to(`conversation/${conversationId}`).emit("conversation/typing", {
        userId: _id,
        isTyping,
      });

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Sent typing status"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/leave", async (data, ack) => {
    try {
      const { conversationId } = data;

      await socket.leave(`conversation/${conversationId}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Left conversation"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });
});

export const getMyConversations = async (
  req: AuthenticatedRequest<
    {},
    {},
    {},
    {
      q?: string;
      type?: string;
    } & PaginationRequest
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id } = req.authUser!;
    const { q, limit = 10, page = 1, type } = req.query;

    const {
      skip,
      limit: parsedLimit,
      paginateResult,
    } = pagination(page, limit);

    const searchFilterQuery: any = q
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

      return ResponseHandler.success(
        res,
        200,
        paginateResult(totalConversations, conversations)
      );
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

export const sendMessageToConversation = async (
  req: AuthenticatedRequest<
    {},
    {},
    {
      content: string;
      type: string;
      receivers: string[];
    },
    {}
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { content, type, receivers } = req.body;
    const { _id } = req.authUser!;

    if (receivers.includes(_id.toString())) {
      throw new HttpError(400, "You cannot send a message to yourself");
    }

    const regex = /#\w+/g;
    const matches = content.match(regex) || [];
    const userIds = [];

    for (const match of matches) {
      try {
        const userId = Types.ObjectId.createFromHexString(match.slice(1));
        userIds.push(userId);
      } catch (error) {
        continue;
      }
    }

    let taggedUsers: any[] = [];

    // Find all tagged users (if any) in message content
    if (userIds.length > 0) {
      taggedUsers = await User.find({ _id: { $in: userIds } })
        .select("username avatar")
        .exec();
    }

    // Get all members of the conversation, including the sender
    const allMembers = [...new Set([...receivers, _id.toString()])];

    // Find existing conversation with the same members, only group and individual conversation
    let conversation = await Conversation.findOne({
      members: { $all: allMembers },
      type: allMembers.length > 2 ? "group" : "individual",
    });

    let hasCreatedNewConversation = false;

    // Check if conversation not found, create a new one
    if (!conversation) {
      // Create a new conversation
      conversation = new Conversation({
        members: allMembers,
        type: allMembers.length > 2 ? "group" : "individual",
        lastTimeEnterChat: {
          [_id.toString()]: Date.now(),
        },
      });
      hasCreatedNewConversation = true;
    }

    let message = new Message({
      senderId: _id,
      content,
      type,
      taggedUsers,
      conversationId: conversation._id,
    });
    let session = await mongoose.startSession();
    try {
      session.startTransaction();

      conversation.lastMessage = message._id;

      // Save conversation and message, create new message and conversation if needed
      await Promise.all([
        conversation.save({ session }),
        message.save({ session }),
      ]);

      // Find the created message, populate senderId and taggedUsers
      const createdMessage = await Message.findOne({ _id: message._id }, null, {
        session,
      });
      if (!createdMessage) {
        throw new HttpError(404, "Message not found");
      }
      message = createdMessage;

      // Notify all members of the conversation about the new message
      for (const member of allMembers) {
        if (hasCreatedNewConversation) {
          io.to(`conversationList/user/${member}`).emit(
            "conversationList/newConversation",
            {
              ...conversation.toJSON(),
              lastMessage: message,
            }
          );
        } else {
          io.to(`conversationList/user/${member}`).emit(
            "conversationList/newMessage",
            {
              conversationId: conversation._id,
              message,
            }
          );
        }
      }

      io.to(`conversation/${conversation._id}`).emit(
        "conversation/newMessage",
        message
      );

      await session.commitTransaction();

      return ResponseHandler.success(res, 201, message);
    } catch (error: any) {
      await session.abortTransaction();
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (e) {
    return next(e);
  }
};

export const editMessage = async (
  req: AuthenticatedRequest<
    { messageId: string },
    {},
    {
      content: string;
    },
    {}
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const { _id } = req.authUser!;

    const [message, conversation] = await Promise.all([
      Message.findOne({
        _id: messageId,
        senderId: _id,
      }),
      Conversation.findOne({
        members: _id,
      }),
    ]);

    if (!conversation) {
      throw new HttpError(
        404,
        "Conversation not found or you are not a member of this conversation"
      );
    }

    if (!message) {
      throw new HttpError(404, "Message not found or you are not the sender");
    }

    if (message.deletedAt) {
      throw new HttpError(403, "Message has been deleted, cannot be edited");
    }

    if (message.type !== "text") {
      throw new HttpError(403, "Only text message can be edited");
    }

    if (message.content === content) {
      return ResponseHandler.success(res, 200, message);
    }

    message.content = content;
    await message.save();

    io.to(`conversation/${conversation._id}`).emit(
      "conversation/messageUpdated",
      message
    );

    if (
      conversation.lastMessage &&
      conversation.lastMessage._id.toString() === message._id.toString()
    ) {
      for (const member of conversation.members) {
        console.log(`conversationList/user/${member._id}`);
        io.to(`conversationList/user/${member._id}`).emit(
          "conversationList/lastMessageChanged",
          {
            conversationId: conversation._id,
            message,
          }
        );
      }
    }

    return ResponseHandler.success(res, 200, message);
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage = async (
  req: AuthenticatedRequest<{ messageId: string }, {}, {}, {}>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    const { _id } = req.authUser!;

    const [message, conversation] = await Promise.all([
      Message.findOne({
        _id: messageId,
        senderId: _id,
      }),
      Conversation.findOne({
        members: _id,
      }),
    ]);

    if (!conversation) {
      throw new HttpError(
        404,
        "Conversation not found or you are not a member of this conversation"
      );
    }

    if (!message) {
      throw new HttpError(404, "Message not found or you are not the sender");
    }

    if (message.deletedAt) {
      throw new HttpError(403, "Message has been deleted");
    }

    const deletedAt = Date.now();
    await Message.updateOne({ _id: messageId }, { deletedAt });

    io.to(`conversation/${conversation._id}`).emit(
      "conversation/messageDeleted",
      {
        ...message.toJSON(),
        deletedAt,
      }
    );

    if (
      conversation.lastMessage &&
      conversation.lastMessage._id.toString() === message._id.toString()
    ) {
      for (const member of conversation.members) {
        io.to(`conversationList/user/${member}`).emit(
          "conversationList/lastMessageDeleted",
          {
            conversationId: conversation._id,
            messageId: message._id,
          }
        );
      }
    }

    return ResponseHandler.success(
      res,
      200,
      {
        messageId: message._id,
      },
      "Message deleted successfully"
    );
  } catch (error) {
    return next(error);
  }
};

export const getConversationDetail = async (
  req: AuthenticatedRequest<
    { conversationId: string },
    {},
    {},
    PaginationRequest
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10 } = req.query;
    const { _id } = req.authUser!;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    if (
      !conversation.members
        .map((member) => member._id.toString())
        .includes(_id.toString())
    ) {
      throw new HttpError(403, "You are not a member of this conversation");
    }

    return ResponseHandler.success(res, 200, conversation);
  } catch (error) {
    return next(error);
  }
};

export const getConversationByReceivers = async (
  req: AuthenticatedRequest<
    {},
    {},
    {
      receivers: string[];
    }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { receivers } = req.body;
    const { _id } = req.authUser!;

    const allMembers = [...new Set([...receivers, _id.toString()])];

    const conversation = await Conversation.findOne({
      members: { $all: allMembers },
      type: allMembers.length > 2 ? "group" : "individual",
    });

    return ResponseHandler.success(res, 200, conversation);
  } catch (error) {
    return next(error);
  }
};

export const getConversationMessages = async (
  req: AuthenticatedRequest<
    { conversationId: string },
    {},
    {},
    PaginationRequest
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    const { _id } = req.authUser!;

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
        .sort({ updatedAt: -1 })
        .limit(parsedLimit)
        .skip(skip)
        .exec();
      return ResponseHandler.success(
        res,
        200,
        paginateResult(messages.length, messages)
      );
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

const markMessagesAsSeen = async (conversationId: string, userId: string) => {
  try {
    const seenAt = Date.now();
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          [`lastTimeEnterChat.${userId}`]: seenAt,
        },
      }
    );

    return seenAt;
  } catch (error: any) {
    throw new HttpError(error.statusCode || 400, error.message, error.errors);
  }
};

export const changeGroupConversationInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = req.params;
    const { _id } = req.authUser!;
    const { name } = req.body;

    let conversation = await Conversation.findOne({
      _id: conversationId,
      members: _id,
      type: { $in: ["group", "channel"] },
    });

    if (!conversation) {
      throw new HttpError(
        404,
        "Group conversation not found or you are not a member of this conversation"
      );
    }

    conversation = Object.assign(conversation, { name });
    try {
      await conversation.save();
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    io.to(`conversation/${conversation._id}`).emit(
      "conversation/infoUpdated",
      conversation
    );

    return ResponseHandler.success(
      res,
      200,
      conversation,
      "Group info updated"
    );
  } catch (error) {
    return next(error);
  }
};

export const addNewMemberToChannel = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = req.params;
    const { username } = req.body;
    const { _id } = req.authUser!;

    const user = await User.findOne({
      username,
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    let conversation = await Conversation.findOne({
      _id,
      type: "channel",
    });

    if (!conversation) {
      throw new HttpError(
        404,
        "Channel conversation not found or you are not a member of this conversation"
      );
    }

    conversation.members.push(user._id);

    try {
      await conversation.save();
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    return ResponseHandler.success(
      res,
      200,
      conversation,
      "Member added to channel"
    );
  } catch (error) {
    return next(error);
  }
};

export const removeMemberFromChannel = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId, memberId } = req.params;
    const { _id } = req.authUser!;

    let conversation = await Conversation.findOne({
      _id,
      type: "channel",
    });

    if (!conversation) {
      throw new HttpError(
        404,
        "Channel conversation not found or you are not a member of this conversation"
      );
    }

    conversation.members = conversation.members.filter(
      (member) => member.toString() !== memberId
    );

    try {
      await conversation.save();
    } catch (error: any) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    io.to(`conversation/${conversation._id}`).emit(
      "conversation/memberRemoved",
      {
        conversationId: conversation._id,
        memberId,
      }
    );

    return ResponseHandler.success(
      res,
      200,
      conversation,
      "Member removed from channel"
    );
  } catch (error) {
    return next(error);
  }
};
