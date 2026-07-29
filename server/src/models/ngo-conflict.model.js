import mongoose from 'mongoose';

const ngoConflictSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, index: true },
    ngoPublicId: { type: String, required: true, index: true },
    reasonCategory: {
      type: String,
      enum: [
        'ngo_recusal', 'existing_relationship', 'geographic_mismatch',
        'capability_mismatch', 'safety_concern', 'capacity_unavailable',
        'administrative_restriction', 'reporter_requested_exclusion'
      ],
      required: true
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);
ngoConflictSchema.index({ complaintId: 1, ngoPublicId: 1 }, { unique: true });
export const NgoConflict = mongoose.model('NgoConflict', ngoConflictSchema);
