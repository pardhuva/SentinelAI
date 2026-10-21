const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    jobId: {
      type: String,
      default: null,
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalTests: {
      type: Number,
      default: 0,
      min: 0,
    },
    passedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    needsReviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    triggerSource: {
      type: String,
      enum: ['manual', 'ci', 'scheduled'],
      default: 'manual',
    },
    baselineScanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      default: null,
    },
    isBaseline: {
      type: Boolean,
      default: false,
      index: true,
    },
    regressionSummary: {
      verdict: {
        type: String,
        enum: ['REGRESSED', 'IMPROVED', 'UNCHANGED', 'FIRST_SCAN', 'NO_BASELINE'],
        default: 'NO_BASELINE',
      },
      regressionsCount: { type: Number, default: 0 },
      fixesCount: { type: Number, default: 0 },
      unresolvedCount: { type: Number, default: 0 },
      consistentPassedCount: { type: Number, default: 0 },
    },
    error: {
      code: String,
      message: String,
    },
  },
  {
    timestamps: true,
  }
);

ScanSchema.index({ applicationId: 1, createdAt: -1 });

module.exports = mongoose.model('Scan', ScanSchema);
