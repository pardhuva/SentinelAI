const mongoose = require('mongoose');

const TestResultSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: [true, 'Scan ID is required'],
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required'],
      index: true,
    },
    testCaseId: {
      type: String,
      required: [true, 'Test case ID is required'],
      index: true,
    },
    testCaseVersion: {
      type: String,
      default: '1.0.0',
    },
    testCaseName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'informational'],
      required: true,
    },
    verdict: {
      type: String,
      enum: ['passed', 'failed', 'error', 'needs_review'],
      required: true,
      index: true,
    },
    inputPrompt: {
      type: String,
      required: true,
    },
    outputResponse: {
      type: String,
      default: '',
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    assertionResults: [
      {
        type: { type: String, required: true },
        passed: { type: Boolean, required: true },
        message: { type: String, required: true },
        evidence: { type: String, default: null },
      },
    ],
    evidence: {
      type: String,
      default: null,
    },
    error: {
      code: String,
      message: String,
      isRetryable: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

TestResultSchema.index({ scanId: 1, testCaseId: 1 });
TestResultSchema.index({ scanId: 1, verdict: 1 });

module.exports = mongoose.model('TestResult', TestResultSchema);
