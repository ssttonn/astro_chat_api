const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const { Conversation, Message, User } = require("../../../models");
const Response = require("../../../utils/responseHandler");
const { HttpError } = require("../../../utils");

exports.sendNewIndividualMessage = async (req, res, next) => {
    try {
      const { _id } = req.authUser;
      const { receiverId } = req.params;
      const { content, type } = req.body;
  
      if (!receiverId) {
        throw new HttpError(400, "Receiver ID is required");
      }
  
      if (_id === receiverId) {
        throw new HttpError(400, "You cannot send a message to yourself");
      }
  
      const regex = /#\w+/g;
      const matches = content.match(regex) || [];
      const userIds = [];
  
      for (const match of matches) {
        try {
          const userId = ObjectId.createFromHexString(match.slice(1));
          userIds.push(userId);
        } catch (error) {
          continue;
        }
      }
  
      const taggedUsers = await User.find({ _id: { $in: userIds } })
        .select("username avatar")
        .exec();
  
      try {
        const session = await mongoose.startSession();
        session.startTransaction();
  
        let conversation = await Conversation.findOne({
          members: { $all: [_id, receiverId] },
          type: "individual",
        });
  
        if (!conversation) {
          conversation = await Conversation.create({
            members: [_id, receiverId],
            type: "individual",
          });
          await conversation.save();
        }
  
        let newMessage = await Message.create({
          senderId: _id,
          conversationId: conversation._id,
          content,
          type,
          taggedUsers,
          seenBy: [_id],
        });
  
        conversation.lastMessage = newMessage._id;
  
        const lastSeenMessage = await Message.findOne({ conversationId: conversation._id, seenBy: _id }).sort({
          createdAt: -1,
        });
  
        if (lastSeenMessage && lastSeenMessage.id !== newMessage.id) {
          lastSeenMessage.seenBy = lastSeenMessage.seenBy.filter((id) => id.toString() !== _id);
          await lastSeenMessage.save();
        }
  
        await conversation.save();
  
        newMessage = await Message.findById(newMessage.id);
  
        await session.commitTransaction();
  
        global.io.to(`chat/${conversation._id}`).emit("conversation/newMessage", newMessage);
  
        return Response.success(res, 201, newMessage);
      } catch (error) {
        await session.abortTransaction();
        throw new HttpError(error.statusCode || 400, error.message, error.errors);
      }
    } catch (error) {
      return next(error);
    }
  };