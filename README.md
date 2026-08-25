# MingleMonkey🐒 — Real-Time Online Messaging Platform

A modern, production-style real-time messaging web application and online stranger matchmaking platform built with **Node.js, Express, Socket.IO, Tailwind CSS, and Vanilla JavaScript**.

---

## 🚀 Features

- **⚡ Real-Time Online Presence**: Live active online user list, customizable status badges (🟢 *Online*, 🟡 *Away*, 🔴 *Busy*, 🟣 *In Chat*), and auto-updating sidebar.
- **🌐 Public Community Channels**: Multi-room channels (`#general`, `#tech-talk`, `#lounge`) with channel isolation, member counts, and rolling history buffers.
- **💬 1-on-1 Direct Messaging (DMs)**: End-to-end private messaging with typing indicators, read receipts, and unread notification badges.
- **🎲 Random Stranger Matchmaking ("CONNECT ONLINE")**:
  - Instant pairing queue for online strangers
  - Pulsing radar state during search
  - Match notification with celebratory alert
  - `Next Person` and `Leave` controls
  - Graceful partner disconnect notifications
- **🎨 Futuristic & Glassmorphic UI**: Deep space dark palette (`#07090D`), amber, cyan & violet accents, frosted translucent surfaces, and responsive 3-column desktop layout.
- **📎 File & Image Sharing**: In-browser attachment previews, image zoom lightbox, document cards, and file validation (Max 5MB, strict MIME/extension checks).
- **😀 Emoji Drawer & Reactions**: Quick emoji picker and real-time message reaction counters (❤️, 👍, 🔥, etc.).
- **🛠 Message Actions**: Hover actions for Copy, Reply with quote, React, and Delete (for own messages).
- **🔊 Synthesized Audio Notifications**: In-browser Web Audio API synthesized chimes for sent/received messages and stranger matchmaking (zero external audio dependencies).
- **🌗 Theme Toggle**: Dark and Light theme support persisted in `localStorage`.
- **📱 Fully Responsive**: Seamless experience on Mobile, Tablet, and Desktop with sliding drawer navigation.

---

## 🛠 Tech Stack

### Backend
- **Node.js & Express**: Web server and static asset hosting.
- **Socket.IO**: Real-time bidirectional event-based communication.
- **UUID**: Unique ID generation for temporary user sessions and messages.
- **CORS**: Cross-Origin Resource Sharing.

### Frontend
- **HTML5 & Semantic Markup**
- **Tailwind CSS & Custom CSS variables**: Futuristic glassmorphic styling and smooth animations.
- **Vanilla JavaScript**: Lightweight client architecture (no heavy frameworks).
- **Lucide Icons**: Clean iconography.
- **Web Audio API**: Real-time sound synthesis.

---

## 📁 Architecture & Folder Structure

```text
online-chat-app/
│
├── package.json          # Manifest & scripts
├── README.md             # Documentation
├── .gitignore            # Git ignore rules
│
├── server/
│   ├── server.js         # Express + Socket.IO server initialization & /health check
│   │
│   ├── socket/           # Modularized Socket.IO handlers
│   │   ├── users.js       # User lifecycle, joins, presence & status
│   │   ├── channels.js    # Community channels, isolation & history
│   │   ├── messages.js    # DMs, typing, reactions & deletions
│   │   └── matchmaking.js # Random stranger matchmaking queue & pairing
│   │
│   └── utils/            # Shared backend utilities
│       ├── users.js       # In-memory user store and session helpers
│       └── validation.js  # Nickname, message, and attachment validators
│
└── public/
    ├── index.html        # Single-page application structure & modals
    ├── app.js            # Client-side Socket.IO engine & UI controller
    └── styles.css        # CSS variables, animations & glassmorphism
```

---

## 📡 Socket.IO Event Architecture

### User Events
| Event | Direction | Description |
| --- | --- | --- |
| `user:join` | Client ➔ Server | Registers temporary profile (nickname, avatar, bio) |
| `user:update` | Client ➔ Server | Updates nickname, avatar, or bio |
| `user:status` | Client ➔ Server | Updates presence status (`online`, `away`, `busy`) |
| `user:list` | Server ➔ Client | Broadcasts updated online users list |
| `user:disconnect` | Server ➔ Client | Notifies when a user disconnects |

### Channel Events
| Event | Direction | Description |
| --- | --- | --- |
| `channel:list` | Client ➔ Server | Fetches list of channels and member counts |
| `channel:join` | Client ➔ Server | Leaves previous room and joins new channel room |
| `channel:message` | Bidirectional | Sends/receives messages in a specific channel |
| `channel:typing` | Bidirectional | Relays typing indicator within channel |
| `channel:member_count`| Server ➔ Client | Broadcasts updated member count for channel |

### Direct Message Events
| Event | Direction | Description |
| --- | --- | --- |
| `dm:open` | Client ➔ Server | Opens 1-on-1 DM session with recipient |
| `dm:message` | Bidirectional | Sends/receives private direct messages |
| `dm:typing` | Bidirectional | Relays typing indicator to DM partner |
| `dm:read` | Bidirectional | Marks conversation as read & emits read receipts |

### Matchmaking Events
| Event | Direction | Description |
| --- | --- | --- |
| `match:find` | Client ➔ Server | Enters matchmaking queue for online strangers |
| `match:waiting` | Server ➔ Client | Notifies client that queue search is active |
| `match:found` | Server ➔ Client | Notifies both users of successful pairing |
| `match:message` | Bidirectional | Relays stranger chat messages |
| `match:typing` | Bidirectional | Relays stranger typing status |
| `match:next` | Client ➔ Server | Skips to next stranger and re-enters queue |
| `match:leave` | Client ➔ Server | Leaves stranger chat and returns to normal rooms |
| `match:partner-left` | Server ➔ Client | Informs remaining user that partner has disconnected |

### Message Actions
| Event | Direction | Description |
| --- | --- | --- |
| `message:reaction` | Bidirectional | Toggles emoji reactions on messages |
| `message:delete` | Bidirectional | Deletes own message from channel or DM history |

---

## 💻 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Production Server**:
   ```bash
   npm start
   ```

3. **Development Mode (Auto-Reload)**:
   ```bash
   npm run dev
   ```

4. **Access the App**:
   Open browser at: **`http://localhost:3000`**
   Health check endpoint: **`http://localhost:3000/health`**

---

## 🧪 Testing Real-Time Behavior

To test multi-user messaging and matchmaking:
1. Open [http://localhost:3000](http://localhost:3000) in **Tab A** (e.g. Nickname: *Coco_Monkey*).
2. Open [http://localhost:3000](http://localhost:3000) in **Tab B** (Incognito or 2nd window, e.g. Nickname: *Koko_Chimp*).
3. Test **Community Channels**: Send messages in `#general` or `#tech-talk`.
4. Test **Direct Messages**: Click on *Koko_Chimp* in the *Direct* sidebar from *Coco_Monkey*'s tab and send a private message.
5. Test **Random Matchmaking**: Click `CONNECT ONLINE` in both tabs to test pairing, skipping, and chat.

---

## ⚠️ Limitations & Notes (V1 Demo)

- **In-Memory Storage**: Message histories and temporary user profiles are maintained in server memory. Server restarts will clear active sessions and history.
- **Temporary File Storage**: Uploaded files and images are encoded as base64 data URLs in memory for demo purposes and are not persisted to a permanent cloud S3 bucket in this V1 version.
