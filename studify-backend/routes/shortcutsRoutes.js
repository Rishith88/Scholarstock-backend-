const express = require('express');
const router = express.Router();

// GET /api/shortcuts — return full shortcut manifest as JSON
router.get('/', (req, res) => {
  const shortcuts = {
    navigation: [
      { key: 'g h', description: 'Go to Home', action: 'navigate', target: '/' },
      { key: 'g b', description: 'Go to Browse', action: 'navigate', target: '/browse' },
      { key: 'g f', description: 'Go to Flashcards', action: 'navigate', target: '/flashcards' },
      { key: 'g r', description: 'Go to Study Rooms', action: 'navigate', target: '/study-rooms' },
      { key: 'g d', description: 'Go to Dashboard', action: 'navigate', target: '/dashboard' },
      { key: 'g l', description: 'Go to Library', action: 'navigate', target: '/library' },
      { key: 'g p', description: 'Go to Profile', action: 'navigate', target: '/profile' },
      { key: 'g c', description: 'Go to Cart', action: 'navigate', target: '/cart' },
    ],
    search: [
      { key: '/', description: 'Focus search', action: 'focus', target: 'search' },
    ],
    modal: [
      { key: 'Escape', description: 'Close modal', action: 'close', target: 'modal' },
    ],
    pdf: [
      { key: 'j', description: 'Next page', action: 'pdf', target: 'nextPage' },
      { key: 'k', description: 'Previous page', action: 'pdf', target: 'prevPage' },
      { key: '+', description: 'Zoom in', action: 'pdf', target: 'zoomIn' },
      { key: '-', description: 'Zoom out', action: 'pdf', target: 'zoomOut' },
      { key: 'f', description: 'Fullscreen', action: 'pdf', target: 'fullscreen' },
    ],
    flashcard: [
      { key: 'n', description: 'New flashcard', action: 'flashcard', target: 'new' },
      { key: 'Space', description: 'Flip card', action: 'flashcard', target: 'flip' },
    ],
    command: [
      { key: 'Cmd+K', description: 'Open command palette', action: 'command', target: 'palette' },
      { key: 'Ctrl+K', description: 'Open command palette', action: 'command', target: 'palette' },
    ],
    help: [
      { key: '?', description: 'Show shortcuts', action: 'help', target: 'shortcuts' },
    ],
  };

  res.json({ success: true, shortcuts });
});

module.exports = router;
