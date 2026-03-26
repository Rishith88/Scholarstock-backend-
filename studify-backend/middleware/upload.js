// ─────────────────────────────────────────────────────
// middleware/upload.js
// Cloudinary + Multer upload middleware
// Drop this file in: studify-backend/middleware/upload.js
// ─────────────────────────────────────────────────────

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

// Store PDFs directly on Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:        'scholarstock/pdfs',
    resource_type: 'raw',      // raw = non-image files like PDF
    allowed_formats: ['pdf'],
    // Use original filename + timestamp so it's unique
    public_id: (req, file) => {
      const name = file.originalname.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
      return `${Date.now()}_${name}`;
    },
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

module.exports = { upload, cloudinary };
