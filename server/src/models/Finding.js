const mongoose = require('mongoose');

const FindingSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required'],
      index: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: [true, 'Scan ID is required'],
      index: true,
    },
    testResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestResult',
      required: [true, 'TestResult ID is required'],
    },
    testCaseId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
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
    evidence: {
      type: String,
      required: true,
    },
    remediation: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'acknowledged'],
      default: 'open',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

FindingSchema.index({ applicationId: 1, status: 1 });
FindingSchema.index({ scanId: 1, severity: 1 });

module.exports = mongoose.model('Finding', FindingSchema);
