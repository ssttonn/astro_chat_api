import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";
import { Types, Document, Model } from "mongoose";
import Conversation from "../models/conversation";
import pagination from "../utils/pagination";
import ResponseHandler from "../utils/responseHandler";
import { HttpError } from "../utils";
import Message from "../models/message";
import SocketResponse from "../utils/socketHandler";
import mongoose from "../db/mongoose";
import {
  AuthenticatedRequest,
  AuthenticatedSocket,
  PaginationRequest,
} from "../models/types";
import { getSocketInstance } from "../services/socketIOClient";

const io = getSocketInstance();

io.on("connection", (socket: AuthenticatedSocket) => {
  socket.on("conversation/user", async ({ userId }, ack) => {
    try {
      const sockets = await io.in(`conversation/user/${userId}`).fetchSockets();

      if (sockets.some((s: any) => s.id === socket.id)) {
        throw new Error("You are already in this conversation");
      }

      await socket.join(`conversation/user/${userId}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/join", async (data, ack) => {
    try {
      const { conversationId } = data;
      const userId = socket.authUser!._id;
      const parsedId = Types.ObjectId.createFromHexString(conversationId);

      const sockets = await io
        .in(`conversation/${conversationId}`)
        .fetchSockets();

      if (sockets.some((s: any) => s.id === socket.id)) {
        throw new Error("You are already in this conversation");
      }

      const conversation = await Conversation.findOne({
        _id: parsedId,
        members: userId,
      });

      if (!conversation) {
        throw new Error(
          "Conversation not found or you are not a member of this conversation"
        );
      }

      if (
        !conversation.members
          .map((member) => member.toString())
          .includes(userId.toString())
      ) {
        throw new Error("You are not a member of this conversation");
      }

      await enterRoom(userId, conversation);
      await socket.join(`conversation/${conversation.id}`);

      if (!ack) {
        return;
      }

      return ack(SocketResponse.success(true, "Joined conversation"));
    } catch (error: any) {
      return ack(SocketResponse.error(error, error.message));
    }
  });

  socket.on("conversation/leave", async (conversationId, ack) => {
    try {
      const sockets = await io.in(`chat/${conversationId}`).fetchSockets();

      if (!sockets.some((s: any) => s.id === socket.id)) {
        throw new Error("You are not in this conversation");
      }

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

    const allMembers = [...new Set([...receivers, _id.toString()])];

    let conversation = await Conversation.findOne({
      members: { $all: allMembers },
      type: allMembers.length > 2 ? "group" : "individual",
    });

    if (!conversation) {
      conversation = new Conversation({
        members: allMembers,
        type: allMembers.length > 2 ? "group" : "individual",
        lastTimeEnterChat: {
          [_id.toString()]: Date.now(),
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

      io.to(`chat/${conversation._id}`).emit(
        "conversation/newMessage",
        message
      );

      return ResponseHandler.success(res, 201, message);
    } catch {
      await session.abortTransaction();
    }
  } catch (e) {
    return next(e);
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
        .map((member) => member.toString())
        .includes(_id.toString())
    ) {
      throw new HttpError(403, "You are not a member of this conversation");
    }

    const messages = await Message.find({ conversationId })
      .limit(Number(limit))
      .exec();

    return ResponseHandler.success(res, 200, {
      ...conversation.toJSON(),
      messages,
    });
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

const enterRoom = async (userId: string, conversation: any) => {
  try {
    let lastTimeEnterChat: any = {};
    const conversationId = conversation.schema.paths._id;
    if (conversation.schema.paths.lastTimeEnterChat) {
      lastTimeEnterChat = {
        ...conversation.schema.paths.lastTimeEnterChat,
      };
    }

    lastTimeEnterChat[userId.toString()] = Date.now();

    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { lastTimeEnterChat: lastTimeEnterChat } }
    );

    return conversation;
  } catch (error: any) {
    throw new HttpError(error.statusCode || 400, error.message, error.errors);
  }
};
