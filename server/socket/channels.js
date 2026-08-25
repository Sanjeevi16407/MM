/**
 * Community Channels Socket Handler for NEXA
 */

const { v4: uuidv4 } = require('uuid');
const { getUserBySocketId, updateUserChannel, getSafeUserProfile } = require('../utils/users');
const { validateMessage } = require('../utils/validation');

const CHANNELS_CONFIG = [
  {
    id: 'general',
    name: 'general',
    topic: 'Main hub for everyone to connect and chat',
    icon: 'hash'
  },
  {
    id: 'tech-talk',
    name: 'tech-talk',
    topic: 'Talk about technology, coding, AI & gadgets',
    icon: 'cpu'
  },
  {
    id: 'lounge',
    name: 'lounge',
    topic: 'Relax, share music, memes and casual conversation',
    icon: 'coffee'
  }
];

// Rolling message history per channel
const channelHistories = {
  general: [],
  'tech-talk': [],
  lounge: []
};
const MAX_CHANNEL_HISTORY = 50;

function registerChannelHandlers(io, socket) {
  // Helper to get active member count for a channel
  function getChannelMemberCount(channelId) {
    const room = io.sockets.adapter.rooms.get(`channel:${channelId}`);
    return room ? room.size : 0;
  }

  // 1. channel:list
  socket.on('channel:list', (callback) => {
    const channels = CHANNELS_CONFIG.map(ch => ({
      ...ch,
      memberCount: getChannelMemberCount(ch.id)
    }));
    if (typeof callback === 'function') {
      callback(channels);
    }
  });

  // 2. channel:join
  socket.on('channel:join', (channelId, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'User not registered' });
      return;
    }

    const channel = CHANNELS_CONFIG.find(c => c.id === channelId);
    if (!channel) {
      if (typeof callback === 'function') callback({ success: false, error: 'Channel does not exist' });
      return;
    }

    // Leave previous channel room if different
    if (user.currentChannel && user.currentChannel !== channelId) {
      socket.leave(`channel:${user.currentChannel}`);
      // Notify previous channel
      io.to(`channel:${user.currentChannel}`).emit('channel:member_count', {
        channelId: user.currentChannel,
        memberCount: getChannelMemberCount(user.currentChannel)
      });
    }

    // Join new channel room
    socket.join(`channel:${channelId}`);
    updateUserChannel(socket.id, channelId);

    // Broadcast updated member count
    io.to(`channel:${channelId}`).emit('channel:member_count', {
      channelId,
      memberCount: getChannelMemberCount(channelId)
    });

    // Send history to user
    const history = channelHistories[channelId] || [];

    if (typeof callback === 'function') {
      callback({
        success: true,
        channel: {
          ...channel,
          memberCount: getChannelMemberCount(channelId)
        },
        history
      });
    }

    // Broadcast system join notification in this channel
    socket.to(`channel:${channelId}`).emit('channel:message', {
      id: 'sys_' + uuidv4(),
      type: 'system',
      channelId,
      senderId: 'system',
      senderName: 'MingleMonkey System',
      senderAvatar: '',
      content: `${user.nickname} joined #${channel.name}`,
      timestamp: Date.now()
    });
  });

  // 3. channel:leave
  socket.on('channel:leave', (channelId) => {
    socket.leave(`channel:${channelId}`);
    io.to(`channel:${channelId}`).emit('channel:member_count', {
      channelId,
      memberCount: getChannelMemberCount(channelId)
    });
  });

  // 4. channel:message
  socket.on('channel:message', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const channelId = data?.channelId || user.currentChannel;
    const channel = CHANNELS_CONFIG.find(c => c.id === channelId);
    if (!channel) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid channel' });
      return;
    }

    const validation = validateMessage(data.content, data.attachment);
    if (!validation.valid) {
      if (typeof callback === 'function') callback({ success: false, error: validation.error });
      return;
    }

    const message = {
      id: uuidv4(),
      type: data.attachment ? (data.attachment.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      channelId,
      senderId: user.id,
      senderName: user.nickname,
      senderAvatar: user.avatar,
      content: validation.content,
      attachment: validation.attachment || null,
      reactions: {},
      timestamp: Date.now()
    };

    if (!channelHistories[channelId]) {
      channelHistories[channelId] = [];
    }

    channelHistories[channelId].push(message);
    if (channelHistories[channelId].length > MAX_CHANNEL_HISTORY) {
      channelHistories[channelId].shift();
    }

    // Broadcast strictly to this channel room
    io.to(`channel:${channelId}`).emit('channel:message', message);

    if (typeof callback === 'function') {
      callback({ success: true, message });
    }
  });

  // 5. channel:history
  socket.on('channel:history', (channelId, callback) => {
    const history = channelHistories[channelId] || [];
    if (typeof callback === 'function') {
      callback(history);
    }
  });

  // 6. channel:typing
  socket.on('channel:typing', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;
    const channelId = data?.channelId || user.currentChannel;

    socket.to(`channel:${channelId}`).emit('channel:typing', {
      channelId,
      userId: user.id,
      nickname: user.nickname,
      isTyping: !!data.isTyping
    });
  });
}

module.exports = {
  registerChannelHandlers,
  channelHistories,
  CHANNELS_CONFIG
};
