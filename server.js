const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB limit for image attachments
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Channels & state
const CHANNELS = ['general', 'tech', 'lounge', 'gaming'];
const channelMessages = {
  general: [],
  tech: [],
  lounge: [],
  gaming: []
};
const MAX_HISTORY = 50;

// Connected users: socket.id -> { id, username, avatar, status, currentRoom, inRandomChat }
const users = new Map();

// Random stranger matchmaking queue: array of socket.id
let strangerQueue = [];
// Active stranger pairs: socketId -> partnerSocketId
const activeStrangerPairs = new Map();

// Helper to sanitize text
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.trim();
}

io.on('connection', (socket) => {
  console.log(`[Socket connected] ID: ${socket.id}`);

  // 1. User joins the platform
  socket.on('user:join', (data, callback) => {
    const username = sanitize(data?.username) || `User_${socket.id.slice(0, 5)}`;
    const avatar = data?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`;
    const bio = sanitize(data?.bio) || 'Ready to chat!';

    const userData = {
      id: socket.id,
      username,
      avatar,
      bio,
      status: 'online',
      currentRoom: 'channel:general',
      joinedAt: Date.now()
    };

    users.set(socket.id, userData);

    // Join general channel by default
    socket.join('channel:general');

    // Broadcast updated users list
    io.emit('users:list', Array.from(users.values()));

    // Send initial channels and message history for general
    if (typeof callback === 'function') {
      callback({
        success: true,
        user: userData,
        channels: CHANNELS,
        messages: channelMessages.general || []
      });
    }

    // Broadcast system message in general
    io.to('channel:general').emit('message:channel', {
      id: 'sys_' + Date.now() + '_' + Math.random(),
      channel: 'general',
      sender: { id: 'system', username: 'System', avatar: '' },
      type: 'system',
      text: `${username} joined the chat. Welcome! 👋`,
      timestamp: Date.now()
    });
  });

  // 2. Channel message
  socket.on('channel:send_message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const channel = data.channel || 'general';
    const text = sanitize(data.text);
    const attachment = data.attachment || null; // { type: 'image', url: '...' }

    if (!text && !attachment) return;

    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      channel,
      sender: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      type: 'user',
      text,
      attachment,
      reactions: {},
      timestamp: Date.now()
    };

    if (!channelMessages[channel]) {
      channelMessages[channel] = [];
    }

    channelMessages[channel].push(message);
    if (channelMessages[channel].length > MAX_HISTORY) {
      channelMessages[channel].shift();
    }

    io.to(`channel:${channel}`).emit('message:channel', message);
  });

  // 3. Switch Channel
  socket.on('channel:join', (channelName, callback) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (!CHANNELS.includes(channelName)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Channel does not exist' });
      return;
    }

    // Leave previous channel room if any
    if (user.currentRoom && user.currentRoom.startsWith('channel:')) {
      socket.leave(user.currentRoom);
    }

    const roomName = `channel:${channelName}`;
    socket.join(roomName);
    user.currentRoom = roomName;

    if (typeof callback === 'function') {
      callback({
        success: true,
        channel: channelName,
        messages: channelMessages[channelName] || []
      });
    }
  });

  // 4. Channel Typing Indicator
  socket.on('channel:typing', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const channel = data.channel || 'general';
    socket.to(`channel:${channel}`).emit('channel:user_typing', {
      channel,
      user: { id: user.id, username: user.username },
      isTyping: !!data.isTyping
    });
  });

  // 5. Message Reaction (Channel)
  socket.on('channel:reaction', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const { channel, messageId, emoji } = data;
    if (!channelMessages[channel]) return;

    const msg = channelMessages[channel].find(m => m.id === messageId);
    if (msg) {
      if (!msg.reactions[emoji]) {
        msg.reactions[emoji] = [];
      }
      const existingIndex = msg.reactions[emoji].indexOf(user.username);
      if (existingIndex > -1) {
        msg.reactions[emoji].splice(existingIndex, 1);
        if (msg.reactions[emoji].length === 0) {
          delete msg.reactions[emoji];
        }
      } else {
        msg.reactions[emoji].push(user.username);
      }

      io.to(`channel:${channel}`).emit('channel:reaction_updated', {
        channel,
        messageId,
        reactions: msg.reactions
      });
    }
  });

  // 6. Direct Messaging (1-on-1)
  socket.on('dm:send_message', (data, callback) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const recipientId = data.recipientId;
    const recipient = users.get(recipientId);
    const text = sanitize(data.text);
    const attachment = data.attachment || null;

    if (!text && !attachment) return;

    const message = {
      id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      senderId: sender.id,
      recipientId: recipientId,
      sender: {
        id: sender.id,
        username: sender.username,
        avatar: sender.avatar
      },
      text,
      attachment,
      timestamp: Date.now()
    };

    // Emit to sender
    socket.emit('message:dm', message);

    // Emit to recipient if online
    if (recipient) {
      io.to(recipientId).emit('message:dm', message);
      if (typeof callback === 'function') callback({ success: true, delivered: true, message });
    } else {
      if (typeof callback === 'function') callback({ success: true, delivered: false, message });
    }
  });

  // 7. DM Typing Indicator
  socket.on('dm:typing', (data) => {
    const sender = users.get(socket.id);
    if (!sender || !data.recipientId) return;

    io.to(data.recipientId).emit('dm:user_typing', {
      senderId: sender.id,
      senderName: sender.username,
      isTyping: !!data.isTyping
    });
  });

  // 8. Random Stranger Matchmaking
  socket.on('stranger:find', (callback) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Clean existing pairing if any
    leaveStrangerChat(socket.id);

    // Remove if already in queue
    strangerQueue = strangerQueue.filter(id => id !== socket.id);

    if (strangerQueue.length > 0) {
      // Found a match!
      const partnerId = strangerQueue.shift();
      const partnerUser = users.get(partnerId);

      if (partnerUser) {
        // Link both users
        activeStrangerPairs.set(socket.id, partnerId);
        activeStrangerPairs.set(partnerId, socket.id);

        user.inRandomChat = true;
        partnerUser.inRandomChat = true;

        const roomId = `stranger_${Date.now()}`;
        socket.join(roomId);
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) partnerSocket.join(roomId);

        // Notify both
        socket.emit('stranger:matched', {
          roomId,
          partner: {
            id: partnerUser.id,
            username: partnerUser.username,
            avatar: partnerUser.avatar,
            bio: partnerUser.bio
          }
        });

        io.to(partnerId).emit('stranger:matched', {
          roomId,
          partner: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            bio: user.bio
          }
        });

        if (typeof callback === 'function') callback({ matched: true });
        return;
      }
    }

    // No partner currently waiting -> put in queue
    strangerQueue.push(socket.id);
    socket.emit('stranger:waiting', { message: 'Searching for an online stranger...' });
    if (typeof callback === 'function') callback({ matched: false, queued: true });
  });

  // Send message in stranger chat
  socket.on('stranger:send_message', (data) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const partnerId = activeStrangerPairs.get(socket.id);
    if (!partnerId) return;

    const text = sanitize(data.text);
    const attachment = data.attachment || null;

    if (!text && !attachment) return;

    const message = {
      id: 'st_msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      senderId: sender.id,
      sender: {
        id: sender.id,
        username: sender.username,
        avatar: sender.avatar
      },
      text,
      attachment,
      timestamp: Date.now()
    };

    socket.emit('message:stranger', message);
    io.to(partnerId).emit('message:stranger', message);
  });

  // Stranger typing
  socket.on('stranger:typing', (data) => {
    const partnerId = activeStrangerPairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('stranger:user_typing', { isTyping: !!data.isTyping });
    }
  });

  // Stranger leave / skip
  socket.on('stranger:leave', () => {
    leaveStrangerChat(socket.id, true);
  });

  // 9. Profile status update
  socket.on('user:update_status', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    if (data.status) user.status = data.status; // 'online' | 'away' | 'busy'
    if (data.bio) user.bio = sanitize(data.bio);
    if (data.username) user.username = sanitize(data.username);
    if (data.avatar) user.avatar = data.avatar;

    io.emit('users:list', Array.from(users.values()));
  });

  // Helper to disconnect stranger chat
  function leaveStrangerChat(socketId, notifyPartner = true) {
    // Remove from queue if waiting
    strangerQueue = strangerQueue.filter(id => id !== socketId);

    const partnerId = activeStrangerPairs.get(socketId);
    if (partnerId) {
      activeStrangerPairs.delete(socketId);
      activeStrangerPairs.delete(partnerId);

      const user = users.get(socketId);
      const partner = users.get(partnerId);
      if (user) user.inRandomChat = false;
      if (partner) partner.inRandomChat = false;

      if (notifyPartner) {
        io.to(partnerId).emit('stranger:disconnected', {
          message: 'Your chat partner has disconnected or skipped.'
        });
      }
    }
  }

  // 10. Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket disconnected] ID: ${socket.id}`);
    const user = users.get(socket.id);

    leaveStrangerChat(socket.id, true);

    if (user) {
      users.delete(socket.id);
      io.emit('users:list', Array.from(users.values()));

      // Notify general channel
      io.to('channel:general').emit('message:channel', {
        id: 'sys_' + Date.now() + '_' + Math.random(),
        channel: 'general',
        sender: { id: 'system', username: 'System', avatar: '' },
        type: 'system',
        text: `${user.username} left the chat.`,
        timestamp: Date.now()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Online Messenger Server is running on http://localhost:${PORT}`);
});
