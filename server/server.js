/**
 * MingleMonkey🐒 - Real-Time Online Messaging Platform Server
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
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MingleMonkey',
    timestamp: new Date().toISOString()
  });
});

// Socket.io connection handler
io.on('connection', (socket) => {
  // Register modular socket event handlers
  registerUserHandlers(io, socket, matchmakingModule);
  registerChannelHandlers(io, socket);
  registerMessageHandlers(io, socket);
  matchmakingModule.registerMatchmakingHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` 🐒 MingleMonkey Server is live on http://localhost:${PORT}`);
  console.log(` 📡 Health check: http://localhost:${PORT}/health`);
  console.log(`========================================`);
});
