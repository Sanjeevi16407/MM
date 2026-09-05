/**
 * MINGLE 🐒 - Real-Time Online Messaging Platform Server
 * (Includes REST Auth Endpoints + Admin Dashboard + Socket.IO WebSockets)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const registerUserHandlers = require('./socket/users');
const { registerChannelHandlers } = require('./socket/channels');
const registerMessageHandlers = require('./socket/messages');
const matchmakingModule = require('./socket/matchmaking');
const registerCallHandlers = require('./socket/call');
const { v4: uuidv4 } = require('uuid');
const { db, scheduleSave } = require('./utils/storage');
const {
  checkUsernameAvailable,
  registerUser,
  loginUser,
  restoreSession,
  getPublicProfile,
  getAdminOverview,
  getUserById,
  getOnlineMinglers,
  getMingledUsers,
  mingleUser,
  searchUsers
} = require('./utils/users');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'https://mm-ten-bay.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173'
];

const corsOriginHandler = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
    callback(null, true);
  } else {
    callback(null, true);
  }
};

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  },
  maxHttpBufferSize: 1e7 // 10MB limit for image and file data
});

// Middleware
app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MingleMonkey',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// REST AUTH & IDENTITY ENDPOINTS
// ==========================================

// Check username availability
app.post('/api/check-username', (req, res) => {
  const { username } = req.body;
  const result = checkUsernameAvailable(username);
  res.json(result);
});

// Register permanent identity
app.post('/api/register', (req, res) => {
  try {
    const user = registerUser({
      username: req.body?.username,
      displayName: req.body?.displayName,
      password: req.body?.password,
      avatar: req.body?.avatar,
      bio: req.body?.bio
    });

    io.emit('user:presence_changed', {
      userId: user.id,
      isOnline: true,
      user: getPublicProfile(user)
    });

    res.json({
      success: true,
      user: getPublicProfile(user, null, true)
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'Registration failed'
    });
  }
});

// Sign in with username & password
app.post('/api/login', (req, res) => {
  try {
    const identifier = req.body?.username || req.body?.identifier;
    const password = req.body?.password;
    const meta = {
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Web Browser'
    };

    const result = loginUser(identifier, password, meta);
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.emit('user:presence_changed', {
      userId: result.user.id,
      isOnline: true,
      user: getPublicProfile(result.user)
    });

    res.json({
      success: true,
      user: getPublicProfile(result.user, null, true)
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Restore / verify persistent session
app.post('/api/session', (req, res) => {
  try {
    const { userId, sessionToken } = req.body;
    const result = restoreSession(userId, sessionToken);
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.emit('user:presence_changed', {
      userId: result.user.id,
      isOnline: true,
      user: getPublicProfile(result.user)
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: 'Session check failed'
    });
  }
});

// Live Online Users (Works across Vercel & WebSockets)
app.get('/api/users/online', (req, res) => {
  try {
    const callerId = req.query.userId;
    const online = getOnlineMinglers(callerId);
    res.json({ success: true, users: online });
  } catch (e) {
    res.json({ success: false, users: [] });
  }
});

// Home summary data
app.get('/api/home-data', (req, res) => {
  try {
    const callerId = req.query.userId;
    const mingles = callerId ? getMingledUsers(callerId) : [];
    const onlineMingles = mingles.filter(m => m.isOnline);
    const allOnline = getOnlineMinglers(callerId);
    res.json({
      success: true,
      onlineMingles,
      onlineMinglesCount: onlineMingles.length,
      minglesCount: mingles.length,
      totalOnlineCount: allOnline.length
    });
  } catch (e) {
    res.json({ success: false, onlineMingles: [], onlineMinglesCount: 0, minglesCount: 0, totalOnlineCount: 0 });
  }
});

// Discovery / Search
app.get('/api/discovery', (req, res) => {
  try {
    const q = req.query.q || '';
    const callerId = req.query.userId;
    const results = searchUsers(q, callerId);
    res.json({ success: true, results });
  } catch (e) {
    res.json({ success: false, results: [] });
  }
});

// Mingle with user
app.post('/api/mingle', (req, res) => {
  try {
    const { userId, targetUserId } = req.body;
    const result = mingleUser(userId, targetUserId);
    res.json(result);
  } catch (e) {
    res.json({ success: false, error: 'Mingle failed' });
  }
});

// DM History & Poll
app.get('/api/messages', (req, res) => {
  try {
    const { userId, partnerId, since } = req.query;
    if (!userId || !partnerId) return res.json({ success: true, messages: [] });

    const messages = db.messages.filter(msg => {
      const match = (msg.senderId === userId && msg.receiverId === partnerId) ||
                    (msg.senderId === partnerId && msg.receiverId === userId);
      if (!match) return false;
      if (since) return msg.timestamp > Number(since);
      return true;
    }).slice(-100);

    res.json({ success: true, messages });
  } catch (e) {
    res.json({ success: false, messages: [] });
  }
});

// Send Message REST
app.post('/api/messages/send', (req, res) => {
  try {
    const { senderId, receiverId, content, attachment } = req.body;
    if (!senderId || !receiverId || (!content && !attachment)) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const sender = getUserById(senderId);
    if (!sender) return res.status(404).json({ success: false, error: 'Sender not found' });

    const msg = {
      id: uuidv4(),
      type: attachment ? (attachment.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      senderId: sender.id,
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
      senderAvatar: sender.avatar,
      receiverId,
      content: content ? content.trim() : '',
      attachment: attachment || null,
      reactions: {},
      read: false,
      timestamp: Date.now()
    };

    db.messages.push(msg);
    scheduleSave();

    // Broadcast via WebSocket if running
    io.to(`user:${receiverId}`).emit('dm:message', msg);
    io.to(`user:${senderId}`).emit('dm:message', msg);

    res.json({ success: true, message: msg });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ==========================================
// ADMIN DASHBOARD & AUDIT ENDPOINTS
// ==========================================

// Visual Admin Portal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Admin Overview Data API (Users, Passwords info, Logins Audit)
app.get('/api/admin/overview', (req, res) => {
  try {
    const overview = getAdminOverview();
    res.json({
      success: true,
      ...overview
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch admin overview'
    });
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  // Register modular socket event handlers
  registerUserHandlers(io, socket, matchmakingModule);
  registerChannelHandlers(io, socket);
  registerMessageHandlers(io, socket);
  registerCallHandlers(io, socket);
  matchmakingModule.registerMatchmakingHandlers(io, socket);
});

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

if (!process.env.VERCEL) {
  try {
    server.listen(PORT, HOST, () => {
      const localIp = getLocalIpAddress();
      console.log(`====================================================`);
      console.log(` 🐒 MINGLE LIVE ON YOUR NETWORK`);
      console.log(` 💻 On Laptop / PC:  http://localhost:${PORT}`);
      console.log(` 📱 On Mobile Phone: http://${localIp}:${PORT}`);
      console.log(` 👑 Admin Portal:    http://${localIp}:${PORT}/admin`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.warn('Server listen skipped or port busy:', err.message);
  }
}

module.exports = app;


