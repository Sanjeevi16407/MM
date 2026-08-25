/**
 * In-memory user store and session management for MingleMonkey🐒
 */

const { v4: uuidv4 } = require('uuid');

// socketId -> User object
const usersBySocket = new Map();
// userId -> socketId
const socketByUserId = new Map();

function createUser({ socketId, nickname, avatar, bio }) {
  const id = uuidv4();
  const user = {
    id,
    socketId,
    nickname,
    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
    bio: bio || 'Exploring MingleMonkey platform',
    status: 'online', // 'online' | 'away' | 'busy' | 'in-chat'
    currentChannel: 'general',
    inRandomChat: false,
    joinedAt: Date.now()
  };

  usersBySocket.set(socketId, user);
  socketByUserId.set(id, socketId);

  return user;
}

function removeUserBySocket(socketId) {
  const user = usersBySocket.get(socketId);
  if (user) {
    socketByUserId.delete(user.id);
    usersBySocket.delete(socketId);
    return user;
  }
  return null;
}

function getUserBySocketId(socketId) {
  return usersBySocket.get(socketId) || null;
}

function getUserById(userId) {
  const socketId = socketByUserId.get(userId);
  if (!socketId) return null;
  return usersBySocket.get(socketId) || null;
}

function getSocketIdByUserId(userId) {
  return socketByUserId.get(userId) || null;
}

function updateUserStatus(socketId, status) {
  const user = usersBySocket.get(socketId);
  if (user) {
    user.status = status;
    return user;
  }
  return null;
}

function updateUserProfile(socketId, { nickname, avatar, bio }) {
  const user = usersBySocket.get(socketId);
  if (user) {
    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    return user;
  }
  return null;
}

function updateUserChannel(socketId, channelId) {
  const user = usersBySocket.get(socketId);
  if (user) {
    user.currentChannel = channelId;
    return user;
  }
  return null;
}

function updateUserRandomChat(socketId, inChat) {
  const user = usersBySocket.get(socketId);
  if (user) {
    user.inRandomChat = inChat;
    return user;
  }
  return null;
}

/**
 * Returns safe public representation of all online users without socketIds or private server metadata
 */
function getOnlineUsersPublic() {
  const list = [];
  for (const user of usersBySocket.values()) {
    list.push(getSafeUserProfile(user));
  }
  return list;
}

function getSafeUserProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
    status: user.status,
    currentChannel: user.currentChannel,
    inRandomChat: user.inRandomChat,
    joinedAt: user.joinedAt
  };
}

module.exports = {
  createUser,
  removeUserBySocket,
  getUserBySocketId,
  getUserById,
  getSocketIdByUserId,
  updateUserStatus,
  updateUserProfile,
  updateUserChannel,
  updateUserRandomChat,
  getOnlineUsersPublic,
  getSafeUserProfile
};
