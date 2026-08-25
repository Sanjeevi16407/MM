/**
 * MINGLE User Identity & Social Graph Socket Handlers
 */

const {
  checkUsernameAvailable,
  registerUser,
  loginUser,
  bindSocketToUser,
  unbindSocket,
  getUserBySocketId,
  getUserById,
  mingleUser,
  unmingleUser,
  getMingledUsers,
  searchUsers,
  getOnlineMinglers,
  updateUserProfile,
  updateUserStatus,
  getPublicProfile,
  getSocketIdByUserId
} = require('../utils/users');

function registerUserHandlers(io, socket, matchmaking) {
  // 1. Check Username Availability
  socket.on('user:check_username', (username, callback) => {
    const result = checkUsernameAvailable(username);
    if (typeof callback === 'function') {
      callback(result);
    }
  });

  // 2. Register Permanent Identity
  socket.on('user:register', (data, callback) => {
    try {
      const user = registerUser({
        username: data?.username,
        displayName: data?.displayName,
        avatar: data?.avatar,
        bio: data?.bio
      });

      bindSocketToUser(socket.id, user.id);
      socket.join(`user:${user.id}`);

      // Broadcast online status to network
      io.emit('user:presence_changed', {
        userId: user.id,
        isOnline: true,
        user: getPublicProfile(user)
      });

      if (typeof callback === 'function') {
        callback({
          success: true,
          user: getPublicProfile(user)
        });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Registration failed' });
      }
    }
  });

  // 3. Login / Reconnect Identity
  socket.on('user:login', (identifier, callback) => {
    try {
      const user = loginUser(identifier);
      if (!user) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'User identity not found' });
        }
        return;
      }

      bindSocketToUser(socket.id, user.id);
      socket.join(`user:${user.id}`);

      // Broadcast presence
      io.emit('user:presence_changed', {
        userId: user.id,
        isOnline: true,
        user: getPublicProfile(user)
      });

      if (typeof callback === 'function') {
        callback({
          success: true,
          user: getPublicProfile(user)
        });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Login failed' });
      }
    }
  });

  // 4. Search Users / Discovery
  socket.on('user:search', (query, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    const results = searchUsers(query, currentUser?.id);
    if (typeof callback === 'function') {
      callback({ success: true, results });
    }
  });

  // 5. Mingle with User
  socket.on('user:mingle', (targetUserId, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    const result = mingleUser(currentUser.id, targetUserId);
    if (result.success) {
      const targetSocketId = getSocketIdByUserId(targetUserId);
      if (targetSocketId) {
        // Notify target user that someone mingled with them!
        io.to(`user:${targetUserId}`).emit('user:mingled_by', {
          mingler: getPublicProfile(currentUser, targetUserId)
        });
      }
    }

    if (typeof callback === 'function') {
      callback(result);
    }
  });

  // 6. Unmingle User
  socket.on('user:unmingle', (targetUserId, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    const result = unmingleUser(currentUser.id, targetUserId);
    if (result.success) {
      io.to(`user:${targetUserId}`).emit('user:unmingled_by', {
        unminglerId: currentUser.id
      });
    }

    if (typeof callback === 'function') {
      callback(result);
    }
  });

  // 7. Get My Mingles Network
  socket.on('user:mingles_list', (callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, mingles: [] });
      return;
    }

    const mingles = getMingledUsers(currentUser.id);
    if (typeof callback === 'function') {
      callback({ success: true, mingles });
    }
  });

  // 8. Get Live Online Minglers
  socket.on('user:online_list', (callback) => {
    const currentUser = getUserBySocketId(socket.id);
    const onlineUsers = getOnlineMinglers(currentUser?.id);
    if (typeof callback === 'function') {
      callback({ success: true, users: onlineUsers });
    }
  });

  // 9. Home Summary Data
  socket.on('user:home_data', (callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false });
      return;
    }

    const mingles = getMingledUsers(currentUser.id);
    const onlineMingles = mingles.filter(m => m.isOnline);
    const allOnline = getOnlineMinglers(currentUser.id);

    if (typeof callback === 'function') {
      callback({
        success: true,
        user: getPublicProfile(currentUser),
        minglesCount: mingles.length,
        onlineMinglesCount: onlineMingles.length,
        onlineMingles,
        totalOnlineCount: allOnline.length
      });
    }
  });

  // 10. Update Profile & Privacy Settings
  socket.on('user:update_profile', (data, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    const updated = updateUserProfile(currentUser.id, {
      displayName: data.displayName,
      avatar: data.avatar,
      bio: data.bio,
      mingleStatus: data.mingleStatus,
      privacySettings: data.privacySettings
    });

    if (typeof callback === 'function') {
      callback({ success: true, user: getPublicProfile(updated) });
    }
  });

  // 11. Update Status & Mingle Status
  socket.on('user:update_status', (data, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    const updated = updateUserStatus(currentUser.id, {
      status: data.status,
      mingleStatus: data.mingleStatus
    });

    io.emit('user:presence_changed', {
      userId: currentUser.id,
      isOnline: true,
      user: getPublicProfile(updated)
    });

    if (typeof callback === 'function') {
      callback({ success: true, user: getPublicProfile(updated) });
    }
  });

  // 12. Disconnect Handler
  socket.on('disconnect', () => {
    const user = unbindSocket(socket.id);
    if (user) {
      if (matchmaking && typeof matchmaking.handleUserDisconnect === 'function') {
        matchmaking.handleUserDisconnect(io, user.id);
      }

      io.emit('user:presence_changed', {
        userId: user.id,
        isOnline: false,
        lastSeen: user.lastSeen,
        user: getPublicProfile(user)
      });
    }
  });
}

module.exports = registerUserHandlers;
