const { Finding } = require('../models');

/**
 * Lists findings with pagination and multi-field filtering.
 * 
 * @param {Object} [filterParams]
 * @param {string} [filterParams.applicationId]
 * @param {string} [filterParams.scanId]
 * @param {string} [filterParams.severity]
 * @param {string} [filterParams.status]
 * @param {string} [filterParams.category]
 * @param {number} [filterParams.page=1]
 * @param {number} [filterParams.limit=50]
 * @returns {Promise<{ findings: Array, pagination: Object }>}
 */
async function listFindings({
  applicationId,
  scanId,
  severity,
  status,
  category,
  page = 1,
  limit = 50,
} = {}) {
  const query = {};

  if (applicationId) query.applicationId = applicationId;
  if (scanId) query.scanId = scanId;
  if (severity) query.severity = severity;
  if (status) query.status = status;
  if (category) query.category = category;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [findings, total] = await Promise.all([
    Finding.find(query)
      .populate('applicationId', 'name targetConfig.url')
      .populate('scanId', 'status startedAt completedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    Finding.countDocuments(query),
  ]);

  return {
    findings,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Retrieves a single finding by ID.
 * 
 * @param {string} findingId
 * @returns {Promise<import('../models/Finding')>}
 */
async function getFindingById(findingId) {
  const finding = await Finding.findById(findingId)
    .populate('applicationId', 'name description targetConfig')
    .populate('scanId', 'status startedAt completedAt totalTests');

  if (!finding) {
    const error = new Error(`Finding with ID "${findingId}" not found.`);
    error.statusCode = 404;
    error.code = 'FINDING_NOT_FOUND';
    throw error;
  }

  return finding;
}

/**
 * Updates finding status and/or triage notes.
 * 
 * @param {string} findingId
 * @param {Object} updateData
 * @param {string} [updateData.status]
 * @param {string} [updateData.notes]
 * @returns {Promise<import('../models/Finding')>}
 */
async function updateFinding(findingId, { status, notes }) {
  const finding = await Finding.findById(findingId);
  if (!finding) {
    const error = new Error(`Finding with ID "${findingId}" not found.`);
    error.statusCode = 404;
    error.code = 'FINDING_NOT_FOUND';
    throw error;
  }

  if (status !== undefined) {
    const validStatuses = ['open', 'investigating', 'resolved', 'acknowledged', 'false_positive'];
    if (!validStatuses.includes(status)) {
      const error = new Error(`Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`);
      error.statusCode = 400;
      error.code = 'INVALID_STATUS';
      throw error;
    }
    finding.status = status;
  }

  if (notes !== undefined) {
    finding.notes = String(notes);
  }

  await finding.save();
  return finding;
}

/**
 * Generates an aggregated summary of findings grouped by severity and status.
 * 
 * @param {Object} [filter]
 * @param {string} [filter.applicationId]
 * @returns {Promise<Object>}
 */
async function getFindingsSummary({ applicationId } = {}) {
  const matchStage = {};
  if (applicationId) {
    const mongoose = require('mongoose');
    matchStage.applicationId = new mongoose.Types.ObjectId(applicationId);
  }

  const [severityCounts, statusCounts, totalCount] = await Promise.all([
    Finding.aggregate([
      { $match: matchStage },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Finding.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Finding.countDocuments(matchStage),
  ]);

  const severityMap = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  severityCounts.forEach((item) => {
    if (severityMap[item._id] !== undefined) {
      severityMap[item._id] = item.count;
    }
  });

  const statusMap = { open: 0, investigating: 0, resolved: 0, acknowledged: 0, false_positive: 0 };
  statusCounts.forEach((item) => {
    if (statusMap[item._id] !== undefined) {
      statusMap[item._id] = item.count;
    }
  });

  return {
    total: totalCount,
    bySeverity: severityMap,
    byStatus: statusMap,
  };
}

module.exports = {
  listFindings,
  getFindingById,
  updateFinding,
  getFindingsSummary,
};
