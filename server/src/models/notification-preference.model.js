import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    smsEnabled: {
      type: Boolean,
      default: false
    },
    whatsappEnabled: {
      type: Boolean,
      default: false
    },
    inAppEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const NotificationPreference = mongoose.model(
  'NotificationPreference',
  notificationPreferenceSchema
);
