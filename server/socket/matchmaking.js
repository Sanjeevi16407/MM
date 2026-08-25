/**
 * Random Stranger Matchmaking Socket Handler for NEXA
 */

const { v4: uuidv4 } = require('uuid');
const {
  getUserBySocketId,
  getUserById,
  updateUserRandomChat,
  getSafeUserProfile
} = require('../utils/users');
const { validateMessage } = require('../utils/validation');

// Matchmaking queue: array of { userId, socketId }
let waitingQueue = [];
// Active matched pairs: userId -> partnerUserId
const activePairs = new Map();

function registerMatchmakingHandlers(io, socket) {
  // Helper to disconnect and cleanup pairing
  function endPairing(userId, notifyPartner = true) {
    // Remove from queue
    waitingQueue = waitingQueue.filter(item => item.userId !== userId);

    const partnerId = activePairs.get(userId);
    if (partnerId) {
      activePairs.delete(userId);
      activePairs.delete(partnerId);

      const user = getUserById(userId);
      const partner = getUserById(partnerId);

      if (user) updateUserRandomChat(user.socketId, false);
      if (partner) updateUserRandomChat(partner.socketId, false);

      if (notifyPartner && partner) {
        io.to(`user:${partnerId}`).emit('match:partner-left', {
          message: 'Your stranger has left the chat.'
        });
      }
    }
  }

  // 1. match:find
  socket.on('match:find', (callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    // Clean any prior pairing
    endPairing(user.id, true);

    // Remove if already in queue
    waitingQueue = waitingQueue.filter(item => item.userId !== user.id);

    // Find first valid waiting user (not self and still online)
    let partnerEntry = null;
    while (waitingQueue.length > 0) {
      const candidate = waitingQueue.shift();
      const candidateUser = getUserById(candidate.userId);
      if (candidateUser && candidate.userId !== user.id) {
        partnerEntry = candidate;
        break;
      }
    }

    if (partnerEntry) {
      // Match found!
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `match_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);

      updateUserRandomChat(socket.id, true);
      updateUserRandomChat(partnerUser.socketId, true);

      // Notify caller
      socket.emit('match:found', {
        matchId: matchRoomId,
        partner: getSafeUserProfile(partnerUser)
      });

      // Notify partner
      io.to(`user:${partnerUser.id}`).emit('match:found', {
        matchId: matchRoomId,
        partner: getSafeUserProfile(user)
      });

      if (typeof callback === 'function') callback({ success: true, matched: true });
    } else {
      // Put user in waiting queue
      waitingQueue.push({ userId: user.id, socketId: socket.id });
      socket.emit('match:waiting', {
        message: 'Searching among online users...'
      });

      if (typeof callback === 'function') callback({ success: true, matched: false, queued: true });
    }
  });

  // 2. match:message
  socket.on('match:message', (data, callback) => {
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
      senderName: user.nickname,
      senderAvatar: user.avatar,
      content: validation.content,
      attachment: validation.attachment || null,
      timestamp: Date.now()
    };

    // Send to partner and sender
    io.to(`user:${partnerId}`).emit('match:message', message);
    socket.emit('match:message', message);

    if (typeof callback === 'function') callback({ success: true, message });
  });

  // 3. match:typing
  socket.on('match:typing', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const partnerId = activePairs.get(user.id);
    if (partnerId) {
      io.to(`user:${partnerId}`).emit('match:typing', {
        isTyping: !!data?.isTyping
      });
    }
  });

  // 4. match:next
  socket.on('match:next', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    endPairing(user.id, true);

    // Re-trigger find
    socket.emit('match:waiting', { message: 'Searching among online users...' });
    
    // Check if another waiting user exists
    let partnerEntry = null;
    while (waitingQueue.length > 0) {
      const candidate = waitingQueue.shift();
      const candidateUser = getUserById(candidate.userId);
      if (candidateUser && candidate.userId !== user.id) {
        partnerEntry = candidate;
        break;
      }
    }

    if (partnerEntry) {
      const partnerUser = getUserById(partnerEntry.userId);
      const matchRoomId = `match_${uuidv4()}`;

      activePairs.set(user.id, partnerUser.id);
      activePairs.set(partnerUser.id, user.id);

      updateUserRandomChat(socket.id, true);
      updateUserRandomChat(partnerUser.socketId, true);

      socket.emit('match:found', {
        matchId: matchRoomId,
        partner: getSafeUserProfile(partnerUser)
      });

      io.to(`user:${partnerUser.id}`).emit('match:found', {
        matchId: matchRoomId,
        partner: getSafeUserProfile(user)
      });
    } else {
      waitingQueue.push({ userId: user.id, socketId: socket.id });
    }
  });

  // 5. match:leave
  socket.on('match:leave', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;
    endPairing(user.id, true);
  });
}

function handleUserDisconnect(io, userId) {
  waitingQueue = waitingQueue.filter(item => item.userId !== userId);
  const partnerId = activePairs.get(userId);
  if (partnerId) {
    activePairs.delete(userId);
    activePairs.delete(partnerId);
    const partner = getUserById(partnerId);
    if (partner) {
      updateUserRandomChat(partner.socketId, false);
      if (io) {
        io.to(`user:${partnerId}`).emit('match:partner-left', {
          message: 'Your stranger has left the chat.'
        });
      }
    }
  }
}

module.exports = {
  registerMatchmakingHandlers,
  handleUserDisconnect
};
