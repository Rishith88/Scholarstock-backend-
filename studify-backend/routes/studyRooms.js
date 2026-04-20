const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const StudyRoom = require('../models/StudyRoom');
const Annotation = require('../models/Annotation');
const SharedNote = require('../models/SharedNote');
const { verifyToken } = require('../middleware/auth');

// Optional rate limiter - fallback to no-op if not available
let roomCreationLimiter = (req, res, next) => next();
try {
  const { roomCreationLimiter: limiter } = require('../middleware/rateLimiter');
  roomCreationLimiter = limiter;
} catch (err) {
  console.warn('⚠️ Rate limiter not available, skipping room creation rate limiting');
}

// Generate a short invite code
function genCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/study-rooms/my — rooms created by or joined by user (MUST be before /:id)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const rooms = await StudyRoom.find({
      'members.userId': req.userId,
      status: 'active',
    }).select('-messages -whiteboardData').sort({ lastActivity: -1 });
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/study-rooms — list public rooms + user's rooms
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { search = '', subject = '' } = req.query;
    const query = { status: 'active' };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (subject) query.subject = { $regex: subject, $options: 'i' };

    // Public rooms OR rooms user is a member of
    query.$or = [
      { isPrivate: false },
      { 'members.userId': userId },
    ];

    const rooms = await StudyRoom.find(query)
      .select('-messages -whiteboardData -annotations')
      .sort({ lastActivity: -1 })
      .limit(50);

    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/study-rooms/:id — get room details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Check access for private rooms
    if (room.isPrivate) {
      const isMember = room.members.some(m => m.userId.toString() === req.userId.toString());
      if (!isMember) return res.status(403).json({ success: false, message: 'This room is private. Use invite code to join.' });
    }

    // Return last 50 messages
    const roomData = room.toObject();
    roomData.messages = roomData.messages.slice(-50);
    res.json({ success: true, room: roomData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/study-rooms — create room
router.post('/', verifyToken, roomCreationLimiter, async (req, res) => {
  try {
    const { name, description, subject, examCategory, isPrivate, maxMembers, sharedMaterialId, sharedMaterialTitle } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Room name is required' });

    const room = await StudyRoom.create({
      name,
      description,
      subject,
      examCategory,
      isPrivate: !!isPrivate,
      inviteCode: genCode(),
      maxMembers: maxMembers || 10,
      createdBy: req.userId,
      createdByName: req.user.name,
      sharedMaterialId: sharedMaterialId || null,
      sharedMaterialTitle: sharedMaterialTitle || null,
      members: [{
        userId: req.userId,
        userName: req.user.name,
        role: 'owner',
        isOnline: true,
      }],
      messages: [{
        userId: req.userId,
        userName: 'System',
        text: `${req.user.name} created the room`,
        type: 'system',
      }],
    });

    res.status(201).json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/study-rooms/join — join by invite code (MUST be before /:id routes)
router.post('/join', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ success: false, message: 'Invite code required' });

    const room = await StudyRoom.findOne({ inviteCode: inviteCode.toUpperCase(), status: 'active' });
    if (!room) return res.status(404).json({ success: false, message: 'Invalid invite code' });

    const alreadyMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (alreadyMember) return res.json({ success: true, room, message: 'Already a member' });

    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }

    room.members.push({ userId: req.userId, userName: req.user.name, role: 'member', isOnline: true });
    room.messages.push({ userId: req.userId, userName: 'System', text: `${req.user.name} joined the room`, type: 'system' });
    room.lastActivity = new Date();
    await room.save();

    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/study-rooms/:id/join — join public room by ID
router.post('/:id/join', verifyToken, async (req, res) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.status !== 'active') return res.status(400).json({ success: false, message: 'Room is not active' });
    if (room.isPrivate) return res.status(403).json({ success: false, message: 'Use invite code to join private room' });

    const alreadyMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (alreadyMember) return res.json({ success: true, room });

    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }

    room.members.push({ userId: req.userId, userName: req.user.name, role: 'member', isOnline: true });
    room.messages.push({ userId: req.userId, userName: 'System', text: `${req.user.name} joined the room`, type: 'system' });
    room.lastActivity = new Date();
    await room.save();

    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/study-rooms/:id/message — send a chat message
router.post('/:id/message', verifyToken, async (req, res) => {
  try {
    const { text, type = 'text', fileUrl, fileName } = req.body;
    if (!text && !fileUrl) return res.status(400).json({ success: false, message: 'Message text or file required' });

    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this room' });

    const msg = { userId: req.userId, userName: req.user.name, text: text || '', type, fileUrl, fileName };
    room.messages.push(msg);

    // Keep only last 200 messages in DB
    if (room.messages.length > 200) room.messages = room.messages.slice(-200);
    room.lastActivity = new Date();
    await room.save();

    const savedMsg = room.messages[room.messages.length - 1];
    res.json({ success: true, message: savedMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/study-rooms/:id/notes — update shared notes
router.put('/:id/notes', verifyToken, async (req, res) => {
  try {
    const { notes } = req.body;
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

    // Update or create SharedNote
    let sharedNote = await SharedNote.findOne({ roomId: req.params.id });
    if (!sharedNote) {
      sharedNote = await SharedNote.create({
        noteId: `note-${Date.now()}`,
        roomId: req.params.id,
        content: notes || '',
        lastEditedBy: req.userId,
      });
    } else {
      sharedNote.content = notes || '';
      sharedNote.lastEditedBy = req.userId;
      sharedNote.lastEditedAt = new Date();
      sharedNote.version += 1;
      await sharedNote.save();
    }

    room.lastActivity = new Date();
    await room.save();
    res.json({ success: true, sharedNote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/study-rooms/:id/page — sync current PDF page
router.put('/:id/page', verifyToken, async (req, res) => {
  try {
    const { page } = req.body;
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const member = room.members.find(m => m.userId.toString() === req.userId.toString());
    if (!member || !['owner', 'moderator'].includes(member.role)) {
      return res.status(403).json({ success: false, message: 'Only owner/moderator can control page' });
    }

    room.currentPage = page;
    room.lastActivity = new Date();
    await room.save();
    res.json({ success: true, page });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/study-rooms/:id/annotation — add annotation
router.post('/:id/annotation', verifyToken, async (req, res) => {
  try {
    const { materialId, pageNumber, type, content, color, x, y, width, height } = req.body;
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

    const annotation = await Annotation.create({
      annotationId: `ann-${Date.now()}`,
      materialId,
      pageNumber: pageNumber || 1,
      userId: req.userId,
      roomId: req.params.id,
      type: type || 'highlight',
      content: content || '',
      color: color || '#3b82f6',
      position: { x: x || 0, y: y || 0, width: width || 0, height: height || 0 },
    });

    room.lastActivity = new Date();
    await room.save();

    res.json({ success: true, annotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/study-rooms/:id/annotation/:annId — remove annotation
router.delete('/:id/annotation/:annId', verifyToken, async (req, res) => {
  try {
    const annotation = await Annotation.findOne({ annotationId: req.params.annId });
    if (!annotation) return res.status(404).json({ success: false, message: 'Annotation not found' });
    if (annotation.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Can only delete your own annotations' });
    }

    await Annotation.deleteOne({ annotationId: req.params.annId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/study-rooms/:id/whiteboard — save whiteboard state
router.put('/:id/whiteboard', verifyToken, async (req, res) => {
  try {
    const { data } = req.body;
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const isMember = room.members.some(m => m.userId.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

    room.whiteboardData = data;
    room.lastActivity = new Date();
    await room.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/study-rooms/:id/leave — leave room
router.delete('/:id/leave', verifyToken, async (req, res) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const memberIdx = room.members.findIndex(m => m.userId.toString() === req.userId.toString());
    if (memberIdx === -1) return res.status(400).json({ success: false, message: 'Not a member' });

    const memberName = room.members[memberIdx].userName;
    room.members.splice(memberIdx, 1);
    room.messages.push({ userId: req.userId, userName: 'System', text: `${memberName} left the room`, type: 'system' });

    // If owner left and there are other members, transfer ownership
    if (room.createdBy.toString() === req.userId.toString() && room.members.length > 0) {
      room.members[0].role = 'owner';
      room.createdBy = room.members[0].userId;
    }

    // If no members left, archive the room
    if (room.members.length === 0) room.status = 'archived';

    room.lastActivity = new Date();
    await room.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/study-rooms/:id — delete room (owner only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const room = await StudyRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can delete this room' });
    }
    await StudyRoom.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
