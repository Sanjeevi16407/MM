/**
 * User Socket Event Handlers for MingleMonkey🐒
 */

const {
  createUser,
  removeUserBySocket,
  getUserBySocketId,
  updateUserStatus,
  updateUserProfile,
  getOnlineUsersPublic,
  getSafeUserProfile
} = require('../utils/users');
const { validateNickname, sanitizeText } = require('../utils/validation');

function registerUserHandlers(io, socket, matchmaking) {
  // 1. user:join
  socket.on('user:join', (data, callback) => {
    try {
      const validation = validateNickname(data?.nickname);
      if (!validation.valid) {
        if (typeof callback === 'function') callback({ success: false, error: validation.error });
        return;
      }

      const avatar = data?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`;
      const bio = sanitizeText(data?.bio) || 'Ready to chat on MingleMonkey🐒!';

      const user = createUser({
        socketId: socket.id,
        nickname: validation.nickname,
        avatar,
        bio
      });

      // Join individual private socket room for DMs using user's persistent UUID
      socket.join(`user:${user.id}`);
      // Join default general channel
      socket.join('channel:general');

      // Broadcast updated online users list
      io.emit('user:list', getOnlineUsersPublic());

      if (typeof callback === 'function') {
        callback({
          success: true,
          user: getSafeUserProfile(user)
        });
      }
    } catch (err) {
      console.error('Error in user:join:', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Failed to join' });
    }
  });

  // 2. user:update
  socket.on('user:update', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'User not registered' });
      return;
    }

    let updatedNickname = undefined;
    if (data.nickname) {
      const val = validateNickname(data.nickname);
      if (!val.valid) {
        if (typeof callback === 'function') callback({ success: false, error: val.error });
        return;
      }
      updatedNickname = val.nickname;
    }

    const updatedBio = data.bio !== undefined ? sanitizeText(data.bio) : undefined;
    const updated = updateUserProfile(socket.id, {
      nickname: updatedNickname,
      avatar: data.avatar,
      bio: updatedBio
    });

    io.emit('user:list', getOnlineUsersPublic());

    if (typeof callback === 'function') {
      callback({ success: true, user: getSafeUserProfile(updated) });
    }
  });

  // 3. user:status
  socket.on('user:status', (status, callback) => {
    const allowed = ['online', 'away', 'busy', 'in-chat'];
    if (!allowed.includes(status)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid status' });
      return;
    }

    const user = updateUserStatus(socket.id, status);
    if (user) {
      io.emit('user:list', getOnlineUsersPublic());
      if (typeof callback === 'function') callback({ success: true, status: user.status });
    }
  });

  // 4. user:list
  socket.on('user:list', (callback) => {
    if (typeof callback === 'function') {
      callback(getOnlineUsersPublic());
    }
  });

  // 5. disconnect
  socket.on('disconnect', () => {
    const user = getUserBySocketId(socket.id);
    if (user) {
      // Clean up matchmaking if in stranger queue or paired
      if (matchmaking && typeof matchmaking.handleUserDisconnect === 'function') {
        matchmaking.handleUserDisconnect(io, user.id);
      }

      // Notify the channel they left
      if (user.currentChannel) {
        io.to(`channel:${user.currentChannel}`).emit('channel:message', {
          id: 'sys_' + Date.now(),
          type: 'system',
          channelId: user.currentChannel,
          senderId: 'system',
          senderName: 'MingleMonkey System',
          senderAvatar: '',
          content: `${user.nickname} disconnected`,
          timestamp: Date.now()
        });
      }

      removeUserBySocket(socket.id);
      io.emit('user:list', getOnlineUsersPublic());
      io.emit('user:disconnect', { userId: user.id, nickname: user.nickname });
    }
  });
}

module.exports = registerUserHandlers;
