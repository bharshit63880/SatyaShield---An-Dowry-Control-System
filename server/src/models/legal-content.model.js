import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  url: { type: String, required: true, trim: true, maxlength: 1000 },
  publisher: { type: String, required: true, trim: true, maxlength: 160 }
}, { _id: false });

const legalContentSchema = new mongoose.Schema({
  contentKey: { type: String, required: true, trim: true, index: true },
  version: { type: Number, required: true, min: 1 },
  language: { type: String, enum: ['en', 'hi'], required: true },
  category: {
    type: String,
    enum: ['general_legal_information', 'evidence_preservation', 'digital_safety',
      'complaint_process', 'privacy', 'ngo_support', 'emergency_non_dispatch', 'safety_resources'],
    required: true
  },
  jurisdiction: { type: String, required: true, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  body: { type: String, required: true, maxlength: 30_000 },
  citations: { type: [citationSchema], default: [] },
  state: {
    type: String,
    enum: ['draft', 'under_review', 'approved', 'published', 'review_due', 'withdrawn', 'archived'],
    default: 'draft', index: true
  },
  reviewerType: { type: String, enum: ['none', 'internal', 'qualified_legal', 'qualified_language'], default: 'none' },
  reviewedAt: { type: Date, default: null },
  lastReviewedAt: { type: Date, default: null },
  reviewDueAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  createdByRef: { type: String, required: true }
}, { timestamps: true });

legalContentSchema.index({ contentKey: 1, version: 1, language: 1 }, { unique: true });

export const LegalContent = mongoose.model('LegalContent', legalContentSchema);
