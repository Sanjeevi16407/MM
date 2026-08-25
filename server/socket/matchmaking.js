/**
 * Surprise Mingle Matchmaking Socket Handler for MINGLE platform
 */

const { v4: uuidv4 } = require('uuid');
const {
  getUserBySocketId,
  getUserById,
  getPublicProfile,
  mingleUser
} = require('../utils/users');
const { validateMessage } = require('../utils/validation');

// Matchmaking queue: array of { userId, socketId }
let surpriseQueue = [];
// Active matched pairs: userId -> partnerUserId
const activePairs = new Map();

function registerMatchmakingHandlers(io, socket) {
  function endPairing(userId, notifyPartner = true) {
    surpriseQueue = surpriseQueue.filter(item => item.userId !== userId);

    const partnerId = activePairs.get(userId);
    if (partnerId) {
      activePairs.delete(userId);
      activePairs.delete(partnerId);

      const partner = getUserById(partnerId);
      if (notifyPartner && partner) {
        io.to(`user:${partnerId}`).emit('surprise:partner-left', {
          message: 'Your surprise match has disconnected.'
        });
      }
    }
  }

  // 1. surprise:find
  socket.on('surprise:find', (callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    endPairing(user.id, true);
    surpriseQueue = surpriseQueue.filter(item => item.userId !== user.id);

    // Find first compatible online user
    let partnerEntry = null;
    while (surpriseQueue.length > 0) {
      const candidate = surpriseQueue.shift();
      const candidateUser = getUserById(candidate.userId);
      if (candidateUser && candidate.userId !== user.id) {
        partnerEntry = candidate;
        break;
      }
    }

    if (partnerEntry) {
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `surprise_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);

      socket.emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(partnerUser, user.id)
      });

      io.to(`user:${partnerUser.id}`).emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(user, partnerUser.id)
      });

      if (typeof callback === 'function') callback({ success: true, matched: true });
    } else {
      surpriseQueue.push({ userId: user.id, socketId: socket.id });
      socket.emit('surprise:waiting', {
        message: 'Looking for an online mingler...'
      });

      if (typeof callback === 'function') callback({ success: true, matched: false, queued: true });
    }
  });

  // 2. surprise:message
  socket.on('surprise:message', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const partnerId = activePairs.get(user.id);
    if (!partnerId) {
      if (typeof callback === 'function') callback({ success: false, error: 'No active match' });
      return;
    }

    const validation = validateMessage(data?.content, data?.attachment);
    if (!validation.valid) {
      if (typeof callback === 'function') callback({ success: false, error: validation.error });
      return;
    }

    const message = {
      id: uuidv4(),
      type: data.attachment ? (data.attachment.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      senderId: user.id,
      senderUsername: user.username,
      senderDisplayName: user.displayName,
      senderAvatar: user.avatar,
      content: validation.content,
      attachment: validation.attachment || null,
      timestamp: Date.now()
    };

    io.to(`user:${partnerId}`).emit('surprise:message', message);
    socket.emit('surprise:message', message);

    if (typeof callback === 'function') callback({ success: true, message });
  });

  // 3. surprise:typing
  socket.on('surprise:typing', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const partnerId = activePairs.get(user.id);
    if (partnerId) {
      io.to(`user:${partnerId}`).emit('surprise:typing', {
        isTyping: !!data?.isTyping
      });
    }
  });

  // 4. surprise:next
  socket.on('surprise:next', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    endPairing(user.id, true);

    socket.emit('surprise:waiting', { message: 'Looking for another online mingler...' });

    let partnerEntry = null;
    while (surpriseQueue.length > 0) {
      const candidate = surpriseQueue.shift();
      const candidateUser = getUserById(candidate.userId);
      if (candidateUser && candidate.userId !== user.id) {
        partnerEntry = candidate;
        break;
      }
    }

    if (partnerEntry) {
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `surprise_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);

      socket.emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(partnerUser, user.id)
      });

      io.to(`user:${partnerUser.id}`).emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(user, partnerUser.id)
      });
    } else {
      surpriseQueue.push({ userId: user.id, socketId: socket.id });
    }
  });

  // 5. surprise:leave
  socket.on('surprise:leave', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;
    endPairing(user.id, true);
  });

  // 6. surprise:mingle_now (Instant Mingle from surprise chat!)
  socket.on('surprise:mingle_now', (callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const partnerId = activePairs.get(user.id);
    if (!partnerId) {
      if (typeof callback === 'function') callback({ success: false, error: 'No active match' });
      return;
    }

    const res = mingleUser(user.id, partnerId);
    if (res.success) {
      io.to(`user:${partnerId}`).emit('user:mingled_by', {
        mingler: getPublicProfile(user, partnerId)
      });
    }

    if (typeof callback === 'function') {
      callback({ success: res.success, mingled: true });
    }
  });
}

function handleUserDisconnect(io, userId) {
  surpriseQueue = surpriseQueue.filter(item => item.userId !== userId);
  const partnerId = activePairs.get(userId);
  if (partnerId) {
    activePairs.delete(userId);
    activePairs.delete(partnerId);
    if (io) {
      io.to(`user:${partnerId}`).emit('surprise:partner-left', {
        message: 'Your surprise match has disconnected.'
      });
    }
  }
}

module.exports = {
  registerMatchmakingHandlers,
  handleUserDisconnect
};
