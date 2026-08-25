/**
 * Persistent Direct Messaging & Conversation Handlers for MINGLE
 */

const { v4: uuidv4 } = require('uuid');
const { db, scheduleSave } = require('../utils/storage');
const { getUserBySocketId, getUserById, getPublicProfile } = require('../utils/users');
const { validateMessage } = require('../utils/validation');

function registerMessageHandlers(io, socket) {
  // 1. Fetch Conversations / Threads List
  socket.on('dm:threads', (callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, threads: [] });
      return;
    }

    const partnerMap = new Map(); // partnerId -> { partner, lastMessage, unreadCount }

    db.messages.forEach(msg => {
      if (msg.senderId === currentUser.id || msg.receiverId === currentUser.id) {
        const partnerId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
        const partner = getUserById(partnerId);
        if (!partner) return;

        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partner: getPublicProfile(partner, currentUser.id),
            lastMessage: msg,
            unreadCount: 0
          });
        } else {
          const entry = partnerMap.get(partnerId);
          if (msg.timestamp > entry.lastMessage.timestamp) {
            entry.lastMessage = msg;
          }
        }

        if (msg.receiverId === currentUser.id && !msg.read) {
          const entry = partnerMap.get(partnerId);
          entry.unreadCount++;
        }
      }
    });

    const threads = Array.from(partnerMap.values()).sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

    if (typeof callback === 'function') {
      callback({ success: true, threads });
    }
  });

  // 2. Open DM with User & Fetch History
  socket.on('dm:open', (recipientId, callback) => {
    const currentUser = getUserBySocketId(socket.id);
    if (!currentUser) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not logged in' });
      return;
    }

    const recipient = getUserById(recipientId);
    if (!recipient) {
      if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
      return;
    }

    // Filter messages between these two users
    const history = db.messages.filter(m => 
      (m.senderId === currentUser.id && m.receiverId === recipientId) ||
      (m.senderId === recipientId && m.receiverId === currentUser.id)
    ).sort((a, b) => a.timestamp - b.timestamp);

    // Mark unread messages as read
    let updated = false;
    history.forEach(m => {
      if (m.receiverId === currentUser.id && !m.read) {
        m.read = true;
        updated = true;
      }
    });

    if (updated) {
      scheduleSave();
      io.to(`user:${recipientId}`).emit('dm:read', { readBy: currentUser.id });
    }

    if (typeof callback === 'function') {
      callback({
        success: true,
        recipient: getPublicProfile(recipient, currentUser.id),
        history
      });
    }
  });

  // 3. Send Direct Message
  socket.on('dm:message', (data, callback) => {
    const sender = getUserBySocketId(socket.id);
    if (!sender) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const recipientId = data?.recipientId;
    const recipient = getUserById(recipientId);
    if (!recipient) {
      if (typeof callback === 'function') callback({ success: false, error: 'Recipient not found' });
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
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
      senderAvatar: sender.avatar,
      receiverId: recipient.id,
      content: validation.content,
      attachment: validation.attachment || null,
      reactions: {},
      read: false,
      timestamp: Date.now()
    };

    db.messages.push(message);
    scheduleSave();

    // Deliver to recipient room and sender room
    io.to(`user:${recipient.id}`).emit('dm:message', message);
    io.to(`user:${sender.id}`).emit('dm:message', message);

    if (typeof callback === 'function') {
      callback({ success: true, message });
    }
  });

  // 4. Typing Indicator
  socket.on('dm:typing', (data) => {
    const sender = getUserBySocketId(socket.id);
    if (!sender || !data?.recipientId) return;

    io.to(`user:${data.recipientId}`).emit('dm:typing', {
      senderId: sender.id,
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
      isTyping: !!data.isTyping
    });
  });

  // 5. Read Receipt
  socket.on('dm:read', (data) => {
    const reader = getUserBySocketId(socket.id);
    if (!reader || !data?.senderId) return;

    let modified = false;
    db.messages.forEach(m => {
      if (m.senderId === data.senderId && m.receiverId === reader.id && !m.read) {
        m.read = true;
        modified = true;
      }
    });

    if (modified) {
      scheduleSave();
      io.to(`user:${data.senderId}`).emit('dm:read', { readBy: reader.id });
    }
  });

  // 6. Message Reaction
  socket.on('message:reaction', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user || !data?.messageId || !data?.emoji) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid parameters' });
      return;
    }

    const msg = db.messages.find(m => m.id === data.messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[data.emoji]) msg.reactions[data.emoji] = [];

      const idx = msg.reactions[data.emoji].indexOf(user.username);
      if (idx > -1) {
        msg.reactions[data.emoji].splice(idx, 1);
        if (msg.reactions[data.emoji].length === 0) {
          delete msg.reactions[data.emoji];
        }
      } else {
        msg.reactions[data.emoji].push(user.username);
      }

      scheduleSave();

      // Emit to sender and receiver
      io.to(`user:${msg.senderId}`).emit('message:reaction', {
        messageId: msg.id,
        reactions: msg.reactions
      });
      io.to(`user:${msg.receiverId}`).emit('message:reaction', {
        messageId: msg.id,
        reactions: msg.reactions
      });

      if (typeof callback === 'function') callback({ success: true, reactions: msg.reactions });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Message not found' });
    }
  });

  // 7. Message Delete
  socket.on('message:delete', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user || !data?.messageId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid request' });
      return;
    }

    const idx = db.messages.findIndex(m => m.id === data.messageId && m.senderId === user.id);
    if (idx > -1) {
      const msg = db.messages[idx];
      db.messages.splice(idx, 1);
      scheduleSave();

      io.to(`user:${msg.senderId}`).emit('message:delete', { messageId: data.messageId });
      io.to(`user:${msg.receiverId}`).emit('message:delete', { messageId: data.messageId });

      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Cannot delete message' });
    }
  });
}

module.exports = registerMessageHandlers;
