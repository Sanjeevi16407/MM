/**
 * User Identity, Mingle Social Graph, and Discovery Engine for MINGLE
 * Includes Password Hashing & Custom Profile Photo Uploads
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { db, scheduleSave } = require('./storage');

// Live active socket connections: socketId -> userId & userId -> socketId
const socketToUser = new Map();
const userToSocket = new Map();

function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (!storedHash || !storedSalt || !password) return false;
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

function normalizeUsername(username) {
  if (typeof username !== 'string') return '';
  return username.trim().toLowerCase().replace(/^@+/, '').trim();
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

function registerUser({ username, displayName, password, avatar, bio }) {
  const check = checkUsernameAvailable(username);
  if (!check.available) {
    throw new Error(check.error);
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  const norm = check.username;
  const id = uuidv4();
  const cleanDisplayName = (displayName && displayName.trim()) || norm;

  const { hash, salt } = hashPassword(password);
  const sessionToken = uuidv4();

  const newUser = {
    id,
    username: norm,
    displayName: cleanDisplayName,
    passwordHash: hash,
    passwordSalt: salt,
    sessionToken,
    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${norm}`,
    bio: (bio && bio.trim()) || 'Happy to mingle and connect!',
    status: 'online', // 'online' | 'away' | 'busy' | 'offline'
    mingleStatus: 'available', // 'available' | 'busy' | 'dnd'
    isOnline: true,
    lastSeen: Date.now(),
    lastLoginAt: Date.now(),
    totalLogins: 1,
    privacySettings: {
      showOnlineStatus: true,
      allowSurpriseMingle: true,
      allowMessagesFromNonMingles: true
    },
    createdAt: Date.now()
  };

  db.users[id] = newUser;
  db.usernames[norm] = id;

  // Record audit log
  recordLoginLog({
    userId: id,
    username: norm,
    displayName: cleanDisplayName,
    status: 'REGISTERED',
    ip: '127.0.0.1'
  });

  scheduleSave();
  return newUser;
}

function recordLoginLog({ userId, username, displayName, status, ip, userAgent, error }) {
  if (!db.loginHistory) db.loginHistory = [];
  const logEntry = {
    id: uuidv4(),
    userId: userId || null,
    username: username || 'unknown',
    displayName: displayName || username || 'Unknown',
    status, // 'SUCCESS' | 'FAILED' | 'REGISTERED'
    error: error || null,
    ip: ip || '127.0.0.1',
    userAgent: userAgent || 'Web Browser',
    timestamp: Date.now(),
    formattedDate: new Date().toLocaleString()
  };

  db.loginHistory.unshift(logEntry);
  if (db.loginHistory.length > 500) {
    db.loginHistory.length = 500; // retain latest 500 logs
  }
  scheduleSave();
  return logEntry;
}

function loginUser(identifier, password, meta = {}) {
  if (!identifier) {
    recordLoginLog({
      username: 'anonymous',
      status: 'FAILED',
      error: 'Empty username',
      ip: meta.ip,
      userAgent: meta.userAgent
    });
    return { success: false, error: 'Please enter a username' };
  }
  const norm = normalizeUsername(identifier);
  
  // Try by username
  let userId = db.usernames[norm];
  // If not found, try by ID directly
  if (!userId && db.users[identifier]) {
    userId = identifier;
  }

  if (!userId || !db.users[userId]) {
    recordLoginLog({
      username: norm,
      status: 'FAILED',
      error: 'User does not exist',
      ip: meta.ip,
      userAgent: meta.userAgent
    });
    return { success: false, error: `@${norm} does not exist. Please check your username or create an identity.` };
  }

  if (!password || password.trim().length === 0) {
    recordLoginLog({
      userId,
      username: norm,
      status: 'FAILED',
      error: 'Missing password',
      ip: meta.ip,
      userAgent: meta.userAgent
    });
    return { success: false, error: 'Please enter your password' };
  }

  const user = db.users[userId];

  // If legacy account has no password yet, set and secure it permanently now
  if (!user.passwordHash || !user.passwordSalt) {
    if (password.length < 4) {
      recordLoginLog({
        userId,
        username: norm,
        displayName: user.displayName,
        status: 'FAILED',
        error: 'Password under 4 characters',
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      return { success: false, error: 'Password must be at least 4 characters to secure this account' };
    }
    const { hash, salt } = hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
  } else {
    // STRICT password check - will reject any incorrect password
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      recordLoginLog({
        userId,
        username: norm,
        displayName: user.displayName,
        status: 'FAILED',
        error: 'Incorrect password entered',
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      return { success: false, error: 'Incorrect password! Access denied.' };
    }
  }

  user.isOnline = true;
  user.lastSeen = Date.now();
  user.lastLoginAt = Date.now();
  user.totalLogins = (user.totalLogins || 0) + 1;
  if (!user.sessionToken) {
    user.sessionToken = uuidv4();
  }

  // Record successful login in audit trail
  recordLoginLog({
    userId,
    username: user.username,
    displayName: user.displayName,
    status: 'SUCCESS',
    ip: meta.ip,
    userAgent: meta.userAgent
  });

  scheduleSave();

  return { success: true, user };
}

function restoreSession(userId, sessionToken) {
  if (!userId) return { success: false, error: 'User ID is required' };
  const user = db.users[userId] || (db.usernames[userId.toLowerCase()] ? db.users[db.usernames[userId.toLowerCase()]] : null);
  if (!user) return { success: false, error: 'User session not found' };

  if (sessionToken && user.sessionToken && user.sessionToken !== sessionToken) {
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  user.isOnline = true;
  user.lastSeen = Date.now();
  scheduleSave();

  return {
    success: true,
    user: getPublicProfile(user, null, true)
  };
}

function getAdminOverview() {
  const usersList = Object.values(db.users).map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio,
    passwordHash: u.passwordHash || 'Not Set',
    passwordSalt: u.passwordSalt || 'Not Set',
    hasPassword: Boolean(u.passwordHash && u.passwordSalt),
    createdAt: u.createdAt,
    createdDate: new Date(u.createdAt).toLocaleString(),
    lastSeen: u.lastSeen,
    lastSeenDate: u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'Never',
    lastLoginAt: u.lastLoginAt,
    lastLoginDate: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never',
    totalLogins: u.totalLogins || 1,
    isOnline: socketToUser.size > 0 && Array.from(socketToUser.values()).includes(u.id),
    status: u.status || 'offline',
    mingleStatus: u.mingleStatus || 'available'
  }));

  return {
    stats: {
      totalUsers: Object.keys(db.users).length,
      onlineUsers: usersList.filter(u => u.isOnline).length,
      totalMingles: db.mingles.length,
      totalMessages: db.messages.length,
      totalLoginEvents: db.loginHistory ? db.loginHistory.length : 0
    },
    users: usersList,
    loginHistory: db.loginHistory ? db.loginHistory.slice(0, 100) : []
  };
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

function getPublicProfile(user, callerUserId = null, isSelf = false) {
  if (!user) return null;
  const online = isUserOnline(user.id);
  const mingled = callerUserId ? areMingled(callerUserId, user.id) : false;
  const count = getMingleCount(user.id);
  const selfMatch = isSelf || (callerUserId && callerUserId === user.id);

  const profile = {
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

  if (selfMatch && user.sessionToken) {
    profile.sessionToken = user.sessionToken;
  }

  return profile;
}

module.exports = {
  checkUsernameAvailable,
  registerUser,
  loginUser,
  restoreSession,
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
  getPublicProfile,
  getAdminOverview,
  recordLoginLog
};
