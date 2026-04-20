const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip,
    skip: (req) => !req.userId,
  });
};

const courseSyncLimiter = createRateLimiter(60 * 60 * 1000, 20, 'Course sync limit: 20 per hour');
const flashcardReviewLimiter = createRateLimiter(60 * 60 * 1000, 200, 'Flashcard review limit: 200 per hour');
const roomCreationLimiter = createRateLimiter(24 * 60 * 60 * 1000, 10, 'Room creation limit: 10 per day');

module.exports = {
  createRateLimiter,
  courseSyncLimiter,
  flashcardReviewLimiter,
  roomCreationLimiter,
};
