/**
 * Persistent JSON file-backed storage manager for MINGLE platform
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory cache
let db = {
  users: {},        // userId -> User
  usernames: {},    // lowerUsername -> userId
  mingles: [],      // [ { id, userId, targetUserId, createdAt } ]
  messages: [],     // [ { id, senderId, receiverId, content, attachment, reactions, read, timestamp } ]
  blocks: [],       // [ { userId, blockedUserId } ]
  loginHistory: []  // [ { id, username, displayName, status, ip, userAgent, timestamp, formattedDate } ]
};

let saveTimeout = null;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

function loadDatabase() {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        db = {
          users: parsed.users || {},
          usernames: parsed.usernames || {},
          mingles: parsed.mingles || [],
          messages: parsed.messages || [],
          blocks: parsed.blocks || [],
          loginHistory: parsed.loginHistory || []
        };
        console.log(`📦 Loaded database: ${Object.keys(db.users).length} users, ${db.mingles.length} mingles, ${db.messages.length} messages, ${db.loginHistory.length} login logs.`);
      }
    } else {
      saveDatabaseSync();
    }
  } catch (err) {
    console.error('Error loading database file (using in-memory):', err.message);
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseAsync();
  }, 300); // 300ms debounce
}

function saveDatabaseAsync() {
  ensureDataDir();
  try {
    const data = JSON.stringify(db, null, 2);
    fs.writeFile(DB_FILE, data, (err) => {
      if (err) console.warn('Note: Could not persist to disk (serverless runtime):', err.message);
    });
  } catch (err) {
    console.warn('Note in saveDatabaseAsync:', err.message);
  }
}

function saveDatabaseSync() {
  ensureDataDir();
  try {
    const data = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, data);
  } catch (err) {
    console.warn('Note in saveDatabaseSync:', err.message);
  }
}

// Initialize on module import
loadDatabase();

module.exports = {
  db,
  scheduleSave,
  saveDatabaseSync,
  loadDatabase
};
