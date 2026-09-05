/**
 * WebRTC 1-on-1 Video & Audio Calling Socket Handlers for MINGLE
 */

const { getUserBySocketId, getUserById, getPublicProfile } = require('../utils/users');

const activeCalls = new Map();
const userInCall = new Map();

function registerCallHandlers(io, socket) {
  socket.on('call:initiate', (data, callback) => {
    const caller = getUserBySocketId(socket.id);
    if (!caller) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { recipientId, callType = 'video' } = data || {};
    if (!recipientId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Recipient is required' });
      return;
    }

    if (recipientId === caller.id) {
      if (typeof callback === 'function') callback({ success: false, error: 'Cannot call yourself' });
      return;
    }

    if (userInCall.has(caller.id)) {
      if (typeof callback === 'function') callback({ success: false, error: 'You are already in a call' });
      return;
    }

    if (userInCall.has(recipientId)) {
      if (typeof callback === 'function') callback({ success: false, error: 'User is currently on another call' });
      return;
    }

    const recipient = getUserById(recipientId);
    if (!recipient) {
      if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
      return;
    }

    const callId = 'call_' + Date.now() + '_' + caller.id.substring(0, 5);
    activeCalls.set(callId, {
      callId,
      callerId: caller.id,
      recipientId: recipient.id,
      type: callType,
      status: 'ringing',
      startTime: Date.now()
    });

    userInCall.set(caller.id, callId);
    userInCall.set(recipient.id, callId);

    io.to('user:' + recipient.id).emit('call:incoming', {
      callId,
      caller: getPublicProfile(caller, recipient.id),
      callType
    });

    if (typeof callback === 'function') {
      callback({
        success: true,
        callId,
        recipient: getPublicProfile(recipient, caller.id)
      });
    }
  });

  socket.on('call:accept', (data, callback) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const { callId } = data || {};
    const call = activeCalls.get(callId);

    if (!call || call.recipientId !== user.id || call.status !== 'ringing') {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid or expired call' });
      return;
    }

    call.status = 'connected';
    call.connectedAt = Date.now();

    io.to('user:' + call.callerId).emit('call:accepted', {
      callId,
      recipient: getPublicProfile(user, call.callerId)
    });

    if (typeof callback === 'function') {
      callback({ success: true, callId });
    }
  });

  socket.on('call:reject', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const { callId, reason = 'declined' } = data || {};
    const call = activeCalls.get(callId);

    if (call) {
      const otherUserId = call.callerId === user.id ? call.recipientId : call.callerId;
      io.to('user:' + otherUserId).emit('call:rejected', {
        callId,
        reason,
        userId: user.id
      });

      activeCalls.delete(callId);
      userInCall.delete(call.callerId);
      userInCall.delete(call.recipientId);
    }
  });

  socket.on('call:signal', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const { callId, targetUserId, signal } = data || {};
    if (!callId || !targetUserId || !signal) return;

    io.to('user:' + targetUserId).emit('call:signal', {
      callId,
      senderId: user.id,
      signal
    });
  });

  socket.on('call:end', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const { callId } = data || {};
    let call = activeCalls.get(callId);

    if (!call) {
      const activeCallId = userInCall.get(user.id);
      if (activeCallId) call = activeCalls.get(activeCallId);
    }

    if (call) {
      const otherUserId = call.callerId === user.id ? call.recipientId : call.callerId;
      io.to('user:' + otherUserId).emit('call:ended', {
        callId: call.callId,
        endedBy: user.id
      });

      activeCalls.delete(call.callId);
      userInCall.delete(call.callerId);
      userInCall.delete(call.recipientId);
    }
  });

  socket.on('call:media_state', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const { targetUserId, videoEnabled, audioEnabled } = data || {};
    if (targetUserId) {
      io.to('user:' + targetUserId).emit('call:media_state_changed', {
        senderId: user.id,
        videoEnabled,
        audioEnabled
      });
    }
  });

  socket.on('disconnect', () => {
    const user = getUserBySocketId(socket.id);
    if (user && userInCall.has(user.id)) {
      const callId = userInCall.get(user.id);
      const call = activeCalls.get(callId);
      if (call) {
        const otherUserId = call.callerId === user.id ? call.recipientId : call.callerId;
        io.to('user:' + otherUserId).emit('call:ended', {
          callId,
          endedBy: user.id,
          reason: 'disconnected'
        });

        activeCalls.delete(callId);
        userInCall.delete(call.callerId);
        userInCall.delete(call.recipientId);
      }
    }
  });
}

module.exports = registerCallHandlers;
