const Conversation = require("../models/conversation");
const pagination = require("../utils/pagination");
const Response = require("../utils/responseHandler");
const { HttpError } = require("../utils");
const { Message } = require("../models");
const { validationResult } = require("express-validator");
const { User } = require("../models");

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
      : {
        };

    if (type) {
      searchFilterQuery.type = type
    }

    const conversations = await Conversation.find({
      members: _id,
      ...searchFilterQuery,
    })
      // Populate user with toJSON method
      .populate([
        {
          path: "members",
          select: "username avatar",
        },
        {
          path: "lastMessage",
          select: "content type createdAt",
        },
      ])
      .limit(parsedLimit)
      .skip(skip)
      .exec(); // Populate members field with username and email

    const totalConversations = await Conversation.countDocuments({
      members: _id,
      ...searchFilterQuery,
    });

    return Response.success(res, 200, paginateResult(totalConversations, conversations));
  } catch (error) {
    return next(error);
  }
};

exports.getConversationDetail = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10 } = req.query;
    const { _id } = req.authUser;

    const conversation = await Conversation.findById(conversationId).populate([
      {
        path: "members",
        select: "username avatar",
      },
      {
        path: "lastMessage",
        select: "content type createdAt",
      },
    ]);
    
    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    console.log(conversation.members, _id);
    if (!conversation.members.map((member) => member.id).includes(_id)) {
      throw new HttpError(403, "You are not a member of this conversation");
    }

    console.log(limit);

    const messages = await Message.find ({ conversationId }).populate({ path: "senderId", select: "username avatar" }).limit(limit).exec();

    return Response.success(res, 200, { ...conversation.toJSON(), messages });
  } catch (error) {
    return next(error);
  }
};

exports.createGroupConversation = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(
        400,
        errors
          .array()
          .map((error) => error.msg)
          .join(", "),
        errors.array()
      );
    }

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

    try {
      let membersCount = await User.countDocuments({ _id: { $in: uniqueMembers } });

      if (membersCount !== uniqueMembers.length) {
        throw new HttpError(404, "One or more members not found");
      }

      let setQuery = { members: [...uniqueMembers, _id], type: "group" };

      const newConversation = await Conversation.create(setQuery);

      return Response.success(
        res,
        201,
        await Conversation.findById(newConversation._id)
          .populate({
            path: "members",
            select: "username avatar",
          })
          .exec()
      );
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
};

exports.getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 10, page = 1} = req.query;
    const { _id } = req.authUser;

    const conversationCount = await Conversation.countDocuments({
      _id: conversationId,
      members: _id,
    });

    if (conversationCount === 0) {
      throw new HttpError(404, "Conversation not found or you are not a member of this conversation");
    }

    const { skip, limit: parsedLimit, paginateResult } = pagination(page, limit);

    const messages = await Message.find({ conversationId })
      .populate({ path: "senderId", select: "username avatar" })
      .limit(parsedLimit)
      .skip(skip)
      .exec();

    return Response.success(res, 200, paginateResult(messages.length, messages));
  } catch (error) {
    return next(error);
  }
}

exports.sendNewGroupMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(
        400,
        errors
          .array()
          .map((error) => error.msg)
          .join(", "),
        errors.array()
      );
    }

    try {
      const { _id } = req.authUser;
      const { conversationId } = req.params;
      const { conversationType } = req.query;
      const { content, type } = req.body;

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
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }

    return Response.success(res, 201, newMessage);
  } catch (error) {
    return next(error);
  }
}

exports.sendNewIndividualMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw new HttpError(
        400,
        errors
          .array()
          .map((error) => error.msg)
          .join(", "),
        errors.array()
      );
    }

    const { _id } = req.authUser;
    const { receiverId } = req.query;
    const { content, type } = req.body;

    if (_id === receiverId) {
      throw new HttpError(400, "You cannot send a message to yourself");
    }

    try {
      let conversation = await Conversation.findOne({
        members: { $all: [_id, receiverId] },
        type: "individual",
      });
  
      if (!conversation) {
        conversation = await Conversation.create({
          members: [_id, receiverId],
          type: "individual",
        });
      }

      const newMessage = await Message.create({
        senderId: _id,
        conversationId: conversation._id,
        content,
        type,
      });
  
      const conversationId = conversation._id;
    
      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage._id });
      return Response.success(res, 201, newMessage);
    } catch (error) {
      throw new HttpError(error.statusCode || 400, error.message, error.errors);
    }
  } catch (error) {
    return next(error);
  }
}