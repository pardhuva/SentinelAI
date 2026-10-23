const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Application name is required'],
      trim: true,
      maxlength: [100, 'Application name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    targetConfig: {
      type: {
        type: String,
        enum: ['http', 'demo'],
        default: 'http',
        required: true,
      },
      url: {
        type: String,
        required: [true, 'Target URL is required'],
        trim: true,
      },
      method: {
        type: String,
        enum: ['POST', 'GET'],
        default: 'POST',
      },
      headers: {
        type: Map,
        of: String,
        default: {},
      },
      canaryValue: {
        type: String,
        default: '',
      },
      timeoutMs: {
        type: Number,
        default: 5000,
        min: 500,
        max: 30000,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    securityProfile: {
      type: String,
      enum: ['general', 'hr', 'banking', 'healthcare', 'customer_support', 'custom'],
      default: 'general',
    },
    enabledCategories: {
      type: [String],
      default: [],
    },
    disabledTestIds: {
      type: [String],
      default: [],
    },
    customTestCases: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    currentBaselineScanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ApplicationSchema.index({ name: 1 });
ApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Application', ApplicationSchema);
