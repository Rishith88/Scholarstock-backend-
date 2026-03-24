# 🎯 STUDIFY BACKEND - COMPLETE SETUP GUIDE

Follow these steps **exactly** in VS Code to get your backend running!

---

## ✅ STEP 1: Open VS Code

1. Open **VS Code**
2. Click **File** → **Open Folder**
3. Navigate to where you want to create the project
4. Create a new folder called `studify-backend`
5. Select it and click **Open**

---

## ✅ STEP 2: Copy Backend Files

1. Copy the entire `studify-backend` folder I provided
2. Paste it into your workspace
3. Your VS Code should now show all these files:

```
studify-backend/
├── server.js
├── package.json
├── .env
├── .gitignore
├── README.md
├── routes/
├── models/
├── middleware/
└── uploads/
```

---

## ✅ STEP 3: Open Terminal in VS Code

1. Press **Ctrl + `** (backtick) OR
2. Click **Terminal** → **New Terminal**
3. Make sure you're in the `studify-backend` folder

```bash
# Verify you're in the right folder
pwd
# Should show: /path/to/studify-backend
```

---

## ✅ STEP 4: Install Dependencies

In the VS Code terminal, run:

```bash
npm install
```

Wait for it to finish. You should see:
```
added 150 packages in 30s
```

---

## ✅ STEP 5: Start MongoDB

### Option A: MongoDB Already Running?

Check if MongoDB is running:

```bash
# Windows (Command Prompt as Admin)
net start MongoDB

# Mac/Linux
sudo systemctl status mongod
```

### Option B: Start MongoDB

**Windows:**
```bash
# If installed as service
net start MongoDB

# Or run directly
mongod
```

**Mac:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

### Option C: Use MongoDB Compass (Easiest!)

1. Open **MongoDB Compass** (GUI app)
2. Click **Connect** (default: localhost:27017)
3. Leave it running in the background

---

## ✅ STEP 6: Verify MongoDB Connection

Open a **new terminal** and run:

```bash
mongosh
```

You should see:
```
Connecting to: mongodb://127.0.0.1:27017
Current Mongosh Log ID: ...
```

Type `exit` to close.

---

## ✅ STEP 7: Start the Backend Server

In VS Code terminal:

```bash
npm start
```

You should see:
```
🚀 ================================
🚀 Studify Backend Server
🚀 ================================
✅ MongoDB connected successfully
📦 Database: studify
📡 Server running on port 5000
🌐 API: http://localhost:5000/api
💚 Health: http://localhost:5000/api/health
```

---

## ✅ STEP 8: Test the Backend

Open your browser and go to:
```
http://localhost:5000/api/health
```

You should see:
```json
{
  "success": true,
  "status": "OK",
  "message": "Studify Backend is running"
}
```

**🎉 SUCCESS! Your backend is running!**

---

## 🧪 STEP 9: Test API Endpoints

### Method 1: Using Browser

Open these URLs in your browser:

**Health Check:**
```
http://localhost:5000/api/health
```

**Get Materials:**
```
http://localhost:5000/api/materials
```

**API Documentation:**
```
http://localhost:5000/
```

### Method 2: Using VS Code REST Client

1. Install **REST Client** extension in VS Code
2. Create a file called `test.http` in your project
3. Add this content:

```http
### Health Check
GET http://localhost:5000/api/health

###
### Signup New User
POST http://localhost:5000/api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

###
### Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

###
### Get All Materials (Public)
GET http://localhost:5000/api/materials

###
### Get Founder Page
GET http://localhost:5000/api/founder
```

4. Click **Send Request** above each section to test

### Method 3: Using Postman

1. Download **Postman** from https://www.postman.com/downloads/
2. Create a new request
3. Test these endpoints:

**Signup:**
- Method: `POST`
- URL: `http://localhost:5000/api/auth/signup`
- Body (JSON):
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "test123"
}
```

---

## 📂 STEP 10: Open Frontend Files

Now that backend is running:

1. Keep the backend terminal running
2. Open `Studify_Client_Enhanced.html` in your browser
3. Open `Studify_Admin_Updated.html` in your browser

The frontend will connect to `http://localhost:5000`

---

## 🐛 TROUBLESHOOTING

### Problem 1: "npm: command not found"

**Solution:** Install Node.js
1. Go to https://nodejs.org/
2. Download LTS version
3. Install it
4. Restart VS Code
5. Try again

---

### Problem 2: "MongoDB connection error"

**Solution A:** Check MongoDB is running
```bash
# Windows
net start MongoDB

# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

**Solution B:** Use MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Get connection string
5. Update `.env` file:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/studify
```

**Solution C:** Check MongoDB Compass
1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Keep it running

---

### Problem 3: "Port 5000 already in use"

**Solution:** Kill the process or change port

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

**Mac/Linux:**
```bash
lsof -ti:5000 | xargs kill -9
```

**Or change port in `.env`:**
```
PORT=3000
```

---

### Problem 4: "Cannot find module 'express'"

**Solution:** Install dependencies again
```bash
npm install
```

---

### Problem 5: Backend starts but API doesn't work

**Check:**
1. Is server running? (see console output)
2. Is MongoDB connected? (see "MongoDB connected" message)
3. Try health endpoint: `http://localhost:5000/api/health`
4. Check terminal for error messages

---

## 🎯 QUICK COMMANDS REFERENCE

```bash
# Install dependencies
npm install

# Start server (normal)
npm start

# Start with auto-reload (if nodemon installed)
npm run dev

# Check MongoDB
mongosh

# View MongoDB databases
mongosh
> show dbs
> use studify
> show collections
> db.users.find()
```

---

## 📊 VERIFY EVERYTHING WORKS

Run this checklist:

- [ ] VS Code is open with `studify-backend` folder
- [ ] Terminal shows "MongoDB connected successfully"
- [ ] Terminal shows "Server running on port 5000"
- [ ] http://localhost:5000/api/health returns JSON
- [ ] http://localhost:5000/ shows API documentation
- [ ] No errors in terminal
- [ ] MongoDB Compass shows `studify` database

**If all checked ✅ - YOU'RE READY!**

---

## 🚀 NEXT STEPS

1. **Create a test user:**
   - Use Postman or REST Client
   - POST to `/api/auth/signup`
   
2. **Upload a PDF:**
   - Login to get JWT token
   - POST to `/api/materials/upload` with token

3. **Open Frontend:**
   - Open `Studify_Client_Enhanced.html`
   - Create account
   - Browse materials
   - Test rentals

4. **Open Admin Panel:**
   - Open `Studify_Admin_Updated.html`
   - Enter vault code: `STUDIFY2024`
   - Login: `admin` / `StudifyAdmin@2024`
   - View dashboard

---

## 📝 COMMON TASKS

### View Database in MongoDB Compass

1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Select `studify` database
4. View collections: `users`, `materials`, `rentals`, `transactions`

### Check Server Logs

Watch the VS Code terminal for:
- API requests
- Errors
- Database operations

### Stop Server

Press `Ctrl + C` in the terminal

### Restart Server

```bash
npm start
```

---

## 💡 TIPS

1. **Keep terminal visible** to see real-time logs
2. **Use MongoDB Compass** to view data visually
3. **Install REST Client** extension for easy API testing
4. **Check console** for any errors
5. **Read error messages** carefully - they tell you what's wrong!

---

## 📞 NEED HELP?

1. Check error message in terminal
2. Look for solution in **TROUBLESHOOTING** section
3. Verify all prerequisites installed
4. Make sure MongoDB is running
5. Try restarting both MongoDB and the server

---

**You're all set! Happy coding! 🎉**

