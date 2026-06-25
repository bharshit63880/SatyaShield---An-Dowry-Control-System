import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      index: true
    },
    senderRole: {
      type: String,
      enum: ['victim', 'ngo', 'investigator', 'admin'],
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // null for anonymous victim
    },
    senderName: {
      type: String,
      default: 'Anonymous Reporter'
    },
    messageEncrypted: {
      type: String,
      required: true
    },
    attachments: [
      {
        fileUrl: String,
        originalName: String,
        mimeType: String
      }
    ],
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

chatMessageSchema.index({ complaintId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
