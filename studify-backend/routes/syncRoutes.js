const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const SyncQueue = require('../models/SyncQueue');
const { resolveConflict } = require('../utils/conflictResolver');

// GET /api/sync/status — return sync status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const pendingOperations = await SyncQueue.countDocuments({
      userId: req.userId,
      synced: false,
    });

    const lastSync = await SyncQueue.findOne({ userId: req.userId, synced: true })
      .sort({ timestamp: -1 });

    const conflictsResolved = await SyncQueue.countDocuments({
      userId: req.userId,
      conflictResolved: true,
    });

    res.json({
      success: true,
      status: {
        pendingOperations,
        lastSyncedAt: lastSync ? lastSync.timestamp : null,
        conflictsResolved,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sync/queue — add to sync queue
router.post('/queue', verifyToken, async (req, res) => {
  try {
    const { operationType, entityType, entityId, data } = req.body;
    if (!operationType || !entityType || !entityId) {
      return res.status(400).json({ success: false, message: 'operationType, entityType, entityId required' });
    }

    const queueItem = await SyncQueue.create({
      userId: req.userId,
      operationType,
      entityType,
      entityId,
      data: data || {},
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, queueItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sync/process — process sync queue with conflict resolution
router.post('/process', verifyToken, async (req, res) => {
  try {
    const pendingItems = await SyncQueue.find({
      userId: req.userId,
      synced: false,
    }).sort({ timestamp: 1 });

    const results = [];
    for (const item of pendingItems) {
      try {
        // Simulate conflict resolution (last-write-wins)
        const resolved = resolveConflict(
          item.data,
          {},
          item.timestamp,
          new Date()
        );

        item.synced = true;
        item.conflictResolved = resolved.winner === 'remote';
        await item.save();

        results.push({
          entityId: item.entityId,
          success: true,
          conflictResolved: item.conflictResolved,
        });
      } catch (err) {
        results.push({
          entityId: item.entityId,
          success: false,
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
