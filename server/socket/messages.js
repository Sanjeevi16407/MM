/**
 * Direct Messaging and Message Action Socket Handler for NEXA
 */

const { v4: uuidv4 } = require('uuid');
const { getUserBySocketId, getUserById, getSafeUserProfile } = require('../utils/users');
const { validateMessage } = require('../utils/validation');
const { channelHistories } = require('./channels');

// In-memory DM conversations: pairKey (sorted userIds) -> [messages]
const dmConversations = new Map();
const MAX_DM_HISTORY = 100;

function getPairKey(user1Id, user2Id) {
  return [user1Id, user2Id].sort().join(':');
}

function registerMessageHandlers(io, socket) {
  // 1. dm:open
  socket.on('dm:open', (recipientId, callback) => {
    const sender = getUserBySocketId(socket.id);
    if (!sender) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const recipient = getUserById(recipientId);
    if (!recipient) {
      if (typeof callback === 'function') callback({ success: false, error: 'User is not online' });
      return;
    }

    const pairKey = getPairKey(sender.id, recipient.id);
    const history = dmConversations.get(pairKey) || [];

    if (typeof callback === 'function') {
      callback({
        success: true,
        recipient: getSafeUserProfile(recipient),
        history
      });
    }
  });

  // 2. dm:message
  socket.on('dm:message', (data, callback) => {
    const sender = getUserBySocketId(socket.id);
    if (!sender) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const recipientId = data?.recipientId;
    const recipient = getUserById(recipientId);
    if (!recipient) {
      if (typeof callback === 'function') callback({ success: false, error: 'Recipient is no longer online' });
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
      senderId: sender.id,
      senderName: sender.nickname,
      senderAvatar: sender.avatar,
      receiverId: recipient.id,
      content: validation.content,
      attachment: validation.attachment || null,
      reactions: {},
      read: false,
      timestamp: Date.now()
    };

    const pairKey = getPairKey(sender.id, recipient.id);
    if (!dmConversations.has(pairKey)) {
      dmConversations.set(pairKey, []);
    }
    const history = dmConversations.get(pairKey);
    history.push(message);
    if (history.length > MAX_DM_HISTORY) {
      history.shift();
    }

    // Route only to sender room and recipient room
    io.to(`user:${recipient.id}`).emit('dm:message', message);
    io.to(`user:${sender.id}`).emit('dm:message', message);

    if (typeof callback === 'function') {
      callback({ success: true, message });
    }
  });

  // 3. dm:typing
  socket.on('dm:typing', (data) => {
    const sender = getUserBySocketId(socket.id);
    if (!sender || !data?.recipientId) return;

    io.to(`user:${data.recipientId}`).emit('dm:typing', {
      senderId: sender.id,
      senderName: sender.nickname,
      isTyping: !!data.isTyping
    });
  });

  // 4. dm:read
  socket.on('dm:read', (data) => {
    const reader = getUserBySocketId(socket.id);
    if (!reader || !data?.senderId) return;

    const pairKey = getPairKey(reader.id, data.senderId);
    const history = dmConversations.get(pairKey);
    if (history) {
      history.forEach(m => {
        if (m.receiverId === reader.id) {
          m.read = true;
        }
      });
    }

    io.to(`user:${data.senderId}`).emit('dm:read', {
      readBy: reader.id
    });
  });

  // 5. message:reaction
  socket.on('message:reaction', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user || !data?.messageId || !data?.emoji) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid parameters' });
      return;
    }

    const { messageId, emoji, channelId, recipientId } = data;
    let targetMessage = null;

    if (channelId && channelHistories[channelId]) {
      targetMessage = channelHistories[channelId].find(m => m.id === messageId);
      if (targetMessage) {
        toggleReaction(targetMessage, emoji, user.nickname);
        io.to(`channel:${channelId}`).emit('message:reaction', {
          messageId,
          reactions: targetMessage.reactions,
          channelId
        });
      }
    } else if (recipientId) {
      const pairKey = getPairKey(user.id, recipientId);
      const history = dmConversations.get(pairKey);
      if (history) {
        targetMessage = history.find(m => m.id === messageId);
        if (targetMessage) {
          toggleReaction(targetMessage, emoji, user.nickname);
          io.to(`user:${recipientId}`).emit('message:reaction', {
            messageId,
            reactions: targetMessage.reactions,
            partnerId: user.id
          });
          io.to(`user:${user.id}`).emit('message:reaction', {
            messageId,
            reactions: targetMessage.reactions,
            partnerId: recipientId
          });
        }
      }
    }

    if (typeof callback === 'function') {
      callback({ success: !!targetMessage, reactions: targetMessage?.reactions || {} });
    }
  });

  // 6. message:delete
  socket.on('message:delete', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user || !data?.messageId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid request' });
      return;
    }

    const { messageId, channelId, recipientId } = data;
    let deleted = false;

    if (channelId && channelHistories[channelId]) {
      const idx = channelHistories[channelId].findIndex(m => m.id === messageId && m.senderId === user.id);
      if (idx !== -1) {
        channelHistories[channelId].splice(idx, 1);
        deleted = true;
        io.to(`channel:${channelId}`).emit('message:delete', { messageId, channelId });
      }
    } else if (recipientId) {
      const pairKey = getPairKey(user.id, recipientId);
      const history = dmConversations.get(pairKey);
      if (history) {
        const idx = history.findIndex(m => m.id === messageId && m.senderId === user.id);
        if (idx !== -1) {
          history.splice(idx, 1);
          deleted = true;
          io.to(`user:${recipientId}`).emit('message:delete', { messageId, partnerId: user.id });
          io.to(`user:${user.id}`).emit('message:delete', { messageId, partnerId: recipientId });
        }
      }
    }

    if (typeof callback === 'function') {
      callback({ success: deleted });
    }
  });
}

function toggleReaction(message, emoji, username) {
  if (!message.reactions) message.reactions = {};
  if (!message.reactions[emoji]) message.reactions[emoji] = [];

  const index = message.reactions[emoji].indexOf(username);
  if (index > -1) {
    message.reactions[emoji].splice(index, 1);
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  } else {
    message.reactions[emoji].push(username);
  }
}

module.exports = registerMessageHandlers;
