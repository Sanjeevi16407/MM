/**
 * User Identity, Mingle Social Graph, and Discovery Engine for MINGLE
 */

const { v4: uuidv4 } = require('uuid');
const { db, scheduleSave } = require('./storage');

// Live active socket connections: socketId -> userId & userId -> socketId
const socketToUser = new Map();
const userToSocket = new Map();

function normalizeUsername(username) {
  if (typeof username !== 'string') return '';
  return username.trim().toLowerCase().replace(/^@/, '');
}

function checkUsernameAvailable(username) {
  const norm = normalizeUsername(username);
  if (!norm || norm.length < 3 || norm.length > 20) {
    return { available: false, error: 'Username must be between 3 and 20 characters' };
  }
  const regex = /^[a-zA-Z0-9_]+$/;
  if (!regex.test(norm)) {
    return { available: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  if (db.usernames[norm]) {
    return { available: false, error: `@${norm} is already taken` };
  }
  return { available: true, username: norm };
}

function registerUser({ username, displayName, avatar, bio }) {
  const check = checkUsernameAvailable(username);
  if (!check.available) {
    throw new Error(check.error);
  }

  const norm = check.username;
  const id = uuidv4();
  const cleanDisplayName = (displayName && displayName.trim()) || norm;

  const newUser = {
    id,
    username: norm,
    displayName: cleanDisplayName,
    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${norm}`,
    bio: (bio && bio.trim()) || 'Happy to mingle and connect!',
    status: 'online', // 'online' | 'away' | 'busy' | 'offline'
    mingleStatus: 'available', // 'available' | 'busy' | 'dnd'
    isOnline: true,
    lastSeen: Date.now(),
    privacySettings: {
      showOnlineStatus: true,
      allowSurpriseMingle: true,
      allowMessagesFromNonMingles: true
    },
    createdAt: Date.now()
  };

  db.users[id] = newUser;
  db.usernames[norm] = id;
  scheduleSave();

  return newUser;
}

function loginUser(identifier) {
  if (!identifier) return null;
  const norm = normalizeUsername(identifier);
  
  // Try by username
  let userId = db.usernames[norm];
  // If not found, try by ID directly
  if (!userId && db.users[identifier]) {
    userId = identifier;
  }

  if (userId && db.users[userId]) {
    const user = db.users[userId];
    user.isOnline = true;
    user.lastSeen = Date.now();
    scheduleSave();
    return user;
  }
  return null;
}

function bindSocketToUser(socketId, userId) {
  socketToUser.set(socketId, userId);
  userToSocket.set(userId, socketId);
  const user = db.users[userId];
  if (user) {
    user.isOnline = true;
    user.lastSeen = Date.now();
    scheduleSave();
  }
}

function unbindSocket(socketId) {
  const userId = socketToUser.get(socketId);
  if (userId) {
    socketToUser.delete(socketId);
    if (userToSocket.get(userId) === socketId) {
      userToSocket.delete(userId);
    }
    const user = db.users[userId];
    if (user) {
      user.isOnline = false;
      user.lastSeen = Date.now();
      scheduleSave();
    }
    return user;
  }
  return null;
}

function getUserById(userId) {
  return db.users[userId] || null;
}

function getUserByUsername(username) {
  const norm = normalizeUsername(username);
  const userId = db.usernames[norm];
  if (!userId) return null;
  return db.users[userId] || null;
}

function getUserBySocketId(socketId) {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;
  return db.users[userId] || null;
}

function getSocketIdByUserId(userId) {
  return userToSocket.get(userId) || null;
}

function isUserOnline(userId) {
  return userToSocket.has(userId);
}

// ----------------------------------------------------
// MINGLE RELATIONSHIPS & SOCIAL GRAPH
// ----------------------------------------------------

function areMingled(userAId, userBId) {
  return db.mingles.some(m => 
    (m.userId === userAId && m.targetUserId === userBId) ||
    (m.userId === userBId && m.targetUserId === userAId)
  );
}

function mingleUser(userId, targetUserId) {
  if (userId === targetUserId) {
    return { success: false, error: 'Cannot mingle with yourself' };
  }
  if (!db.users[userId] || !db.users[targetUserId]) {
    return { success: false, error: 'User not found' };
  }

  if (areMingled(userId, targetUserId)) {
    return { success: true, alreadyMingled: true, message: 'Already mingled' };
  }

  const mingleEntry = {
    id: uuidv4(),
    userId,
    targetUserId,
    createdAt: Date.now()
  };

  db.mingles.push(mingleEntry);
  scheduleSave();

  return {
    success: true,
    mingled: true,
    mingleCount: getMingleCount(targetUserId)
  };
}

function unmingleUser(userId, targetUserId) {
  const initialLen = db.mingles.length;
  db.mingles = db.mingles.filter(m => 
    !((m.userId === userId && m.targetUserId === targetUserId) ||
      (m.userId === targetUserId && m.targetUserId === userId))
  );

  if (db.mingles.length !== initialLen) {
    scheduleSave();
    return { success: true, unmingled: true };
  }
  return { success: false, error: 'Not currently mingled' };
}

function getMingleCount(userId) {
  return db.mingles.filter(m => m.userId === userId || m.targetUserId === userId).length;
}

function getMingledUsers(userId) {
  const user = db.users[userId];
  if (!user) return [];

  const partnerIds = new Set();
  db.mingles.forEach(m => {
    if (m.userId === userId) partnerIds.add(m.targetUserId);
    if (m.targetUserId === userId) partnerIds.add(m.userId);
  });

  const list = [];
  partnerIds.forEach(id => {
    const partner = db.users[id];
    if (partner) {
      list.push(getPublicProfile(partner, userId));
    }
  });

  return list;
}

function searchUsers(query, callerUserId) {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim().replace(/^@/, '');
  if (!q) return [];

  const results = [];
  for (const user of Object.values(db.users)) {
    if (user.id === callerUserId) continue;

    const matchUsername = user.username.toLowerCase().includes(q);
    const matchDisplayName = user.displayName.toLowerCase().includes(q);

    if (matchUsername || matchDisplayName) {
      results.push(getPublicProfile(user, callerUserId));
    }
  }

  return results.slice(0, 30);
}

function getOnlineMinglers(callerUserId) {
  const list = [];
  for (const user of Object.values(db.users)) {
    if (user.id === callerUserId) continue;
    if (isUserOnline(user.id)) {
      list.push(getPublicProfile(user, callerUserId));
    }
  }
  return list;
}

function updateUserProfile(userId, { displayName, avatar, bio, privacySettings, mingleStatus }) {
  const user = db.users[userId];
  if (!user) return null;

  if (displayName) user.displayName = displayName.trim();
  if (avatar) user.avatar = avatar;
  if (bio !== undefined) user.bio = bio.trim();
  if (mingleStatus) user.mingleStatus = mingleStatus;
  if (privacySettings) {
    user.privacySettings = {
      ...user.privacySettings,
      ...privacySettings
    };
  }

  scheduleSave();
  return user;
}

function updateUserStatus(userId, { status, mingleStatus }) {
  const user = db.users[userId];
  if (!user) return null;

  if (status) user.status = status;
  if (mingleStatus) user.mingleStatus = mingleStatus;

  scheduleSave();
  return user;
}

function getPublicProfile(user, callerUserId = null) {
  if (!user) return null;
  const online = isUserOnline(user.id);
  const mingled = callerUserId ? areMingled(callerUserId, user.id) : false;
  const count = getMingleCount(user.id);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio,
    status: online ? (user.status || 'online') : 'offline',
    mingleStatus: user.mingleStatus || 'available',
    isOnline: online,
    lastSeen: user.lastSeen || Date.now(),
    mingleCount: count,
    isMingled: mingled,
    privacySettings: user.privacySettings || {
      showOnlineStatus: true,
      allowSurpriseMingle: true,
      allowMessagesFromNonMingles: true
    },
    createdAt: user.createdAt
  };
}

module.exports = {
  checkUsernameAvailable,
  registerUser,
  loginUser,
  bindSocketToUser,
  unbindSocket,
  getUserById,
  getUserByUsername,
  getUserBySocketId,
  getSocketIdByUserId,
  isUserOnline,
  areMingled,
  mingleUser,
  unmingleUser,
  getMingleCount,
  getMingledUsers,
  searchUsers,
  getOnlineMinglers,
  updateUserProfile,
  updateUserStatus,
  getPublicProfile
};
