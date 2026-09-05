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

// Matchmaking queue: array of { userId, socketId, mode }
let surpriseQueue = [];
// Active matched pairs: userId -> partnerUserId
const activePairs = new Map();
// Active pair modes: userId -> 'video' | 'text'
const pairModes = new Map();

function registerMatchmakingHandlers(io, socket) {
  function endPairing(userId, notifyPartner = true) {
    surpriseQueue = surpriseQueue.filter(item => item.userId !== userId);

    const partnerId = activePairs.get(userId);
    if (partnerId) {
      activePairs.delete(userId);
      activePairs.delete(partnerId);
      pairModes.delete(userId);
      pairModes.delete(partnerId);

      const partner = getUserById(partnerId);
      if (notifyPartner && partner) {
        io.to(`user:${partnerId}`).emit('surprise:partner-left', {
          message: 'Stranger has skipped/disconnected.'
        });
      }
    }
  }

  // 1. surprise:find
  socket.on('surprise:find', (data, callback) => {
    if (typeof data === 'function') {
      callback = data;
      data = { mode: 'video' };
    }
    const mode = data?.mode === 'text' ? 'text' : 'video';

    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    endPairing(user.id, true);
    surpriseQueue = surpriseQueue.filter(item => item.userId !== user.id);

    // Find first compatible online user with matching mode
    let partnerIndex = -1;
    for (let i = 0; i < surpriseQueue.length; i++) {
      const candidate = surpriseQueue[i];
      if (candidate.userId !== user.id && candidate.mode === mode) {
        const candidateUser = getUserById(candidate.userId);
        if (candidateUser) {
          partnerIndex = i;
          break;
        }
      }
    }

    if (partnerIndex !== -1) {
      const partnerEntry = surpriseQueue.splice(partnerIndex, 1)[0];
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `surprise_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);
      pairModes.set(user.id, mode);
      pairModes.set(partnerUser.id, mode);

      socket.emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(partnerUser, user.id),
        mode,
        isInitiator: true
      });

      io.to(`user:${partnerUser.id}`).emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(user, partnerUser.id),
        mode,
        isInitiator: false
      });

      if (typeof callback === 'function') callback({ success: true, matched: true, mode });
    } else {
      surpriseQueue.push({ userId: user.id, socketId: socket.id, mode });
      socket.emit('surprise:waiting', {
        message: mode === 'video' ? 'Searching for next random stranger...' : 'Looking for an online mingler...',
        mode
      });

      if (typeof callback === 'function') callback({ success: true, matched: false, queued: true, mode });
    }
  });

  // 2. surprise:signal (Omegle WebRTC P2P Video/Audio Signaling)
  socket.on('surprise:signal', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const partnerId = activePairs.get(user.id);
    if (!partnerId || !data?.signal) return;

    io.to(`user:${partnerId}`).emit('surprise:signal', {
      senderId: user.id,
      signal: data.signal
    });
  });

  // 3. surprise:message
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

  // 4. surprise:typing
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

  // 5. surprise:next (Omegle Fast Skip)
  socket.on('surprise:next', (data) => {
    const mode = data?.mode === 'text' ? 'text' : (pairModes.get(socket.id) || 'video');
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    endPairing(user.id, true);

    socket.emit('surprise:waiting', {
      message: 'Searching for next random stranger...',
      mode
    });

    let partnerIndex = -1;
    for (let i = 0; i < surpriseQueue.length; i++) {
      const candidate = surpriseQueue[i];
      if (candidate.userId !== user.id && candidate.mode === mode) {
        const candidateUser = getUserById(candidate.userId);
        if (candidateUser) {
          partnerIndex = i;
          break;
        }
      }
    }

    if (partnerIndex !== -1) {
      const partnerEntry = surpriseQueue.splice(partnerIndex, 1)[0];
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `surprise_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);
      pairModes.set(user.id, mode);
      pairModes.set(partnerUser.id, mode);

      socket.emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(partnerUser, user.id),
        mode,
        isInitiator: true
      });

      io.to(`user:${partnerUser.id}`).emit('surprise:matched', {
        matchId: matchRoomId,
        partner: getPublicProfile(user, partnerUser.id),
        mode,
        isInitiator: false
      });
    } else {
      surpriseQueue.push({ userId: user.id, socketId: socket.id, mode });
    }
  });

  // 6. surprise:leave
  socket.on('surprise:leave', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;
    endPairing(user.id, true);
  });

  // 7. surprise:mingle_now (Instant Mingle from surprise chat!)
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
    pairModes.delete(userId);
    pairModes.delete(partnerId);
    if (io) {
      io.to(`user:${partnerId}`).emit('surprise:partner-left', {
        message: 'Stranger has disconnected.'
      });
    }
  }
}

module.exports = {
  registerMatchmakingHandlers,
  handleUserDisconnect
};
