import mongoose from 'mongoose';

const investigatorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    badgeNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    agency: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    assignedDistricts: {
      type: [String],
      default: []
    },
    assignedCities: {
      type: [String],
      default: []
    },
    activeCasesCount: {
      type: Number,
      default: 0
    },
    totalCasesAssigned: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const Investigator = mongoose.model('Investigator', investigatorSchema);
