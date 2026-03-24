# 🎓 Studify Backend API

Complete Node.js + Express + MongoDB backend for the Studify study material rental platform.

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web framework
- `mongoose` - MongoDB object modeling
- `bcryptjs` - Password hashing
- `jsonwebtoken` - Authentication tokens
- `dotenv` - Environment variables
- `cors` - Cross-origin requests
- `multer` - File uploads

### 2. Start MongoDB

**Option A: Local MongoDB**
```bash
# Windows (if installed as service)
net start MongoDB

# Mac/Linux
sudo mongod

# Or use MongoDB Compass (GUI)
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Get connection string
4. Update `MONGO_URI` in `.env`

### 3. Configure Environment

The `.env` file is already created. Update if needed:

```env
MONGO_URI=mongodb://localhost:27017/studify
JWT_SECRET=your_secure_random_string_here
PORT=5000
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
✅ MongoDB connected successfully
🚀 Studify Backend Server running on port 5000
```

## 📁 Project Structure

```
studify-backend/
├── server.js           # Main Express server
├── .env                # Environment variables (DO NOT COMMIT)
├── package.json        # Dependencies
├── routes/             # API endpoints
│   ├── auth.js        # Authentication (signup/login)
│   ├── materials.js   # PDF upload & streaming
│   ├── rentals.js     # Rental management
│   ├── admin.js       # Admin dashboard
│   └── founder.js     # Founder page content
├── models/             # MongoDB schemas
│   ├── User.js        # User model
│   ├── Material.js    # Study material model
│   ├── Rental.js      # Rental model
│   └── Transaction.js # Transaction model
├── middleware/         # Custom middleware
│   └── auth.js        # JWT authentication
├── uploads/            # Uploaded PDFs
│   └── pdfs/
└── data/               # JSON data files
    └── founder.json
```

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Create new account | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get current user | Private |

**Example Signup:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Materials

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/materials` | List all active materials | Public |
| GET | `/api/materials/all` | List all materials (admin) | Private |
| POST | `/api/materials/upload` | Upload PDF | Private |
| DELETE | `/api/materials/:id` | Delete material | Private |
| GET | `/api/materials/:id/stream` | Stream PDF | Private |

**Example Upload (Postman/Insomnia):**
```
Method: POST
URL: http://localhost:5000/api/materials/upload
Headers: 
  Authorization: Bearer YOUR_JWT_TOKEN
Body (form-data):
  title: "JEE Physics Notes"
  examLabel: "JEE"
  examId: "jee"
  type: "notes"
  pricePerDay: 29
  pages: 150
  pdf: [Select PDF file]
```

### Rentals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/rentals/my` | Get user's rentals | Private |
| GET | `/api/rentals/check/:materialId` | Check rental status | Private |
| POST | `/api/rentals/create` | Create new rental | Private |
| GET | `/api/rentals/all` | Get all rentals | Private |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/dashboard` | Dashboard stats | Private |
| GET | `/api/admin/users` | All users | Private |
| DELETE | `/api/admin/users/:id` | Delete user | Private |
| GET | `/api/admin/transactions` | All transactions | Private |
| GET | `/api/admin/earnings` | Revenue data | Private |

### Founder Page

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/founder` | Get founder content | Public |
| POST | `/api/founder` | Update content | Private |

## 🔒 Authentication

This API uses JWT (JSON Web Tokens) for authentication.

### Getting a Token

1. **Signup** or **Login**
2. Receive JWT token in response
3. Include token in subsequent requests:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Token Expiry
- Tokens expire after 30 days
- After expiry, user must login again

## 🧪 Testing the API

### Using VS Code REST Client

Create a file `test.http`:

```http
### Health Check
GET http://localhost:5000/api/health

### Signup
POST http://localhost:5000/api/auth/signup
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "test123"
}

### Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "test123"
}

### Get Materials
GET http://localhost:5000/api/materials
```

### Using Postman

1. Download [Postman](https://www.postman.com/downloads/)
2. Import the collection (create from endpoints above)
3. Test each endpoint

### Using cURL

```bash
# Health Check
curl http://localhost:5000/api/health

# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123"}'

# Get Materials
curl http://localhost:5000/api/materials
```

## 📦 Database Schema

### User
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  phone: String,
  isActive: Boolean,
  createdAt: Date
}
```

### Material
```javascript
{
  title: String (required),
  examId: String (required),
  examLabel: String (required),
  type: String (required),
  pages: Number (required),
  pricePerDay: Number (required),
  filePath: String (required),
  status: String (active/inactive),
  stars: Number (0-5),
  createdAt: Date
}
```

### Rental
```javascript
{
  userId: ObjectId (ref: User),
  materialId: ObjectId (ref: Material),
  plan: String (day/week/month/bundle),
  pricePaid: Number,
  startDate: Date,
  expiryDate: Date,
  status: String (active/expired)
}
```

### Transaction
```javascript
{
  userId: ObjectId (ref: User),
  materialId: ObjectId (ref: Material),
  rentalId: ObjectId (ref: Rental),
  amount: Number,
  plan: String,
  status: String (completed/pending/failed),
  createdAt: Date
}
```

## 🐛 Troubleshooting

### MongoDB Connection Failed

**Problem:** `MongoDB connection error`

**Solution:**
```bash
# 1. Check if MongoDB is running
mongosh

# 2. Verify connection string in .env
MONGO_URI=mongodb://localhost:27017/studify

# 3. Try MongoDB Atlas instead
```

### Port Already in Use

**Problem:** `Port 5000 is already in use`

**Solution:**
```bash
# Change PORT in .env
PORT=3000

# Or kill the process using port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

### CORS Errors

**Problem:** `CORS policy blocked`

**Solution:** Already configured to allow all origins in development. For production, update `server.js`:

```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

### File Upload Fails

**Problem:** PDF upload returns error

**Solution:**
```bash
# 1. Check uploads/pdfs directory exists
mkdir -p uploads/pdfs

# 2. Check file size (limit is 50MB)

# 3. Verify file is PDF format
```

## 🔧 Development Tips

### Auto-reload on Changes

```bash
# Install nodemon globally
npm install -g nodemon

# Use dev script
npm run dev
```

### View Database

**MongoDB Compass (GUI):**
1. Download [MongoDB Compass](https://www.mongodb.com/try/download/compass)
2. Connect to: `mongodb://localhost:27017`
3. View `studify` database

**Command Line:**
```bash
mongosh
use studify
show collections
db.users.find()
db.materials.find()
```

### Debugging

Add to any file:
```javascript
console.log('Debug:', variable);
```

Or use VS Code debugger:
1. Add breakpoint (click left of line number)
2. Press F5 or Run → Start Debugging

## 📊 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://localhost:27017/studify |
| JWT_SECRET | Secret key for JWT | (random string) |
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |

## 🚀 Deployment

### Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create studify-backend

# Add MongoDB
heroku addons:create mongolab

# Deploy
git push heroku main

# Set environment variables
heroku config:set JWT_SECRET=your_secret_key
```

### Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add MongoDB plugin
4. Set environment variables

### Render

1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect GitHub repo
4. Add environment variables

## 📝 License

MIT License - feel free to use for learning and projects!

## 🤝 Support

Having issues? 
1. Check troubleshooting section above
2. Review error messages carefully
3. Verify all prerequisites installed
4. Check MongoDB is running

---

**Built with ❤️ for Studify - Making Education Accessible**
