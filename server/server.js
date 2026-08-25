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
const {
  checkUsernameAvailable,
  registerUser,
  loginUser,
  restoreSession,
  getPublicProfile,
  getAdminOverview
} = require('./utils/users');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB limit for image and file data
});

// Middleware
app.use(cors());
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

if (!process.env.VERCEL && (require.main === module || !process.env.NODE_ENV || process.env.NODE_ENV !== 'production')) {
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


