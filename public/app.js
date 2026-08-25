/**
 * MingleMonkey🐒 — Real-Time Online Messaging Platform
 * Client Application Engine
 */

// 1. SOUND NOTIFICATIONS ENGINE (Web Audio API Synthesizer)
class MingleSound {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('mingle_sound') !== 'false';
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
  }

  playSend() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.08); // G5
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch(e) {}
  }

  playReceive() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(987.77, this.ctx.currentTime + 0.14); // B5
      gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch(e) {}
  }

  playMatchFound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.08, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.2);
      });
    } catch(e) {}
  }
}

const soundManager = new MingleSound();

// 2. CLIENT APPLICATION STATE
const state = {
  socket: null,
  currentUser: null, // { id, nickname, avatar, bio, status }
  activeNavTab: 'channels', // 'channels' | 'dms' | 'stranger'
  currentChannel: 'general',
  activeDmPartner: null, // safe user object
  activeStranger: null, // safe stranger user object
  channels: [
    { id: 'general', name: 'general', topic: 'Main hub for everyone to connect and chat', icon: 'hash', memberCount: 0 },
    { id: 'tech-talk', name: 'tech-talk', topic: 'Talk about technology, coding, AI & gadgets', icon: 'cpu', memberCount: 0 },
    { id: 'lounge', name: 'lounge', topic: 'Relax, share music, memes and casual conversation', icon: 'coffee', memberCount: 0 }
  ],
  onlineUsers: [],
  channelMessages: new Map(), // channelId -> [messages]
  dmMessages: new Map(), // partnerId -> [messages]
  unreadDMs: new Map(), // partnerId -> count
  sharedMedia: [], // list of attachments in active conversation
  typingTimer: null,
  attachedFile: null, // { name, type, size, data }
  avatarSeeds: ['Neo', 'Trinity', 'Morpheus', 'Cypher', 'Oracle', 'Ghost'],
  selectedAvatarSeed: 'Neo'
};

// 3. DOM ELEMENTS MAPPING
const DOM = {
  toastContainer: document.getElementById('toastContainer'),
  // Profile Setup Modal
  setupModal: document.getElementById('setupModal'),
  setupForm: document.getElementById('setupForm'),
  modalAvatarList: document.getElementById('modalAvatarList'),
  modalRandomizeAvatars: document.getElementById('modalRandomizeAvatars'),
  modalNicknameInput: document.getElementById('modalNicknameInput'),
  modalBioInput: document.getElementById('modalBioInput'),
  setupErrorMsg: document.getElementById('setupErrorMsg'),

  // Header & Global Controls
  mobileSidebarToggle: document.getElementById('mobileSidebarToggle'),
  connectionStatusBadge: document.getElementById('connectionStatusBadge'),
  connectionStatusText: document.getElementById('connectionStatusText'),
  globalSearchInput: document.getElementById('globalSearchInput'),
  soundBtn: document.getElementById('soundBtn'),
  soundBtnIcon: document.getElementById('soundBtnIcon'),
  themeBtn: document.getElementById('themeBtn'),
  themeBtnIcon: document.getElementById('themeBtnIcon'),
  toggleDetailsBtn: document.getElementById('toggleDetailsBtn'),
  headerProfileTrigger: document.getElementById('headerProfileTrigger'),
  headerUserAvatar: document.getElementById('headerUserAvatar'),
  headerUserName: document.getElementById('headerUserName'),

  // Sidebar
  mainSidebar: document.getElementById('mainSidebar'),
  tabChannels: document.getElementById('tabChannels'),
  tabDms: document.getElementById('tabDms'),
  tabConnect: document.getElementById('tabConnect'),
  globalDmBadge: document.getElementById('globalDmBadge'),
  quickConnectBanner: document.getElementById('quickConnectBanner'),
  sidebarFilterInput: document.getElementById('sidebarFilterInput'),
  sectionChannels: document.getElementById('sectionChannels'),
  channelsListContainer: document.getElementById('channelsListContainer'),
  sectionOnlineUsers: document.getElementById('sectionOnlineUsers'),
  sidebarOnlineCount: document.getElementById('sidebarOnlineCount'),
  onlineUsersListContainer: document.getElementById('onlineUsersListContainer'),
  sidebarUserAvatar: document.getElementById('sidebarUserAvatar'),
  sidebarStatusDot: document.getElementById('sidebarStatusDot'),
  sidebarUsername: document.getElementById('sidebarUsername'),
  sidebarUserBio: document.getElementById('sidebarUserBio'),
  sidebarStatusSelect: document.getElementById('sidebarStatusSelect'),

  // Main Standard Chat Pane
  standardChatPane: document.getElementById('standardChatPane'),
  headerChannelIconContainer: document.getElementById('headerChannelIconContainer'),
  headerChannelIcon: document.getElementById('headerChannelIcon'),
  currentChatTitle: document.getElementById('currentChatTitle'),
  currentChatTypeBadge: document.getElementById('currentChatTypeBadge'),
  currentChatTopic: document.getElementById('currentChatTopic'),
  currentChatMembersCount: document.getElementById('currentChatMembersCount'),
  memberCountNumber: document.getElementById('memberCountNumber'),
  clearChatHistoryBtn: document.getElementById('clearChatHistoryBtn'),
  chatMessagesFeed: document.getElementById('chatMessagesFeed'),
  liveTypingStrip: document.getElementById('liveTypingStrip'),
  liveTypingText: document.getElementById('liveTypingText'),

  // Attachment Preview
  inputAttachmentBar: document.getElementById('inputAttachmentBar'),
  previewThumbnailContainer: document.getElementById('previewThumbnailContainer'),
  previewImageElement: document.getElementById('previewImageElement'),
  previewDocIcon: document.getElementById('previewDocIcon'),
  previewFileName: document.getElementById('previewFileName'),
  previewFileSize: document.getElementById('previewFileSize'),
  cancelAttachmentBtn: document.getElementById('cancelAttachmentBtn'),

  // Emoji Picker Drawer
  emojiPickerDrawer: document.getElementById('emojiPickerDrawer'),
  emojiGridButtons: document.getElementById('emojiGridButtons'),

  // Chat Input Form
  mainChatForm: document.getElementById('mainChatForm'),
  fileAttachmentInput: document.getElementById('fileAttachmentInput'),
  attachFileBtn: document.getElementById('attachFileBtn'),
  toggleEmojiBtn: document.getElementById('toggleEmojiBtn'),
  chatMessageInput: document.getElementById('chatMessageInput'),
  sendMessageBtn: document.getElementById('sendMessageBtn'),

  // Stranger Matchmaking View
  strangerChatPane: document.getElementById('strangerChatPane'),
  strangerHeaderTitle: document.getElementById('strangerHeaderTitle'),
  strangerHeaderSubtitle: document.getElementById('strangerHeaderSubtitle'),
  strangerNextPersonBtn: document.getElementById('strangerNextPersonBtn'),
  strangerExitBtn: document.getElementById('strangerExitBtn'),
  strangerSearchingOrb: document.getElementById('strangerSearchingOrb'),
  cancelSearchingStrangerBtn: document.getElementById('cancelSearchingStrangerBtn'),
  strangerActiveChatContainer: document.getElementById('strangerActiveChatContainer'),
  strangerPartnerAvatar: document.getElementById('strangerPartnerAvatar'),
  strangerPartnerName: document.getElementById('strangerPartnerName'),
  strangerPartnerBio: document.getElementById('strangerPartnerBio'),
  strangerMessagesFeed: document.getElementById('strangerMessagesFeed'),
  strangerTypingIndicator: document.getElementById('strangerTypingIndicator'),
  strangerChatForm: document.getElementById('strangerChatForm'),
  strangerMessageInput: document.getElementById('strangerMessageInput'),

  // Right Details Panel
  rightDetailsPanel: document.getElementById('rightDetailsPanel'),
  closeDetailsPanelBtn: document.getElementById('closeDetailsPanelBtn'),
  detailsAvatar: document.getElementById('detailsAvatar'),
  detailsStatusDot: document.getElementById('detailsStatusDot'),
  detailsTitle: document.getElementById('detailsTitle'),
  detailsSubtitle: document.getElementById('detailsSubtitle'),
  detailsAboutText: document.getElementById('detailsAboutText'),
  detailsMediaCount: document.getElementById('detailsMediaCount'),
  detailsMediaGrid: document.getElementById('detailsMediaGrid'),

  // Lightbox Modal
  imageLightboxModal: document.getElementById('imageLightboxModal'),
  lightboxImageElement: document.getElementById('lightboxImageElement')
};

// 4. INITIALIZATION
function initializeMingleMonkey() {
  lucide.createIcons();
  setupThemeState();
  setupSoundButtonUI();
  setupAvatarPicker();
  setupEventListeners();
  initSocketConnection();
}

// 5. TOAST NOTIFICATION HELPER
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgClass = type === 'error' 
    ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40' 
    : (type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900/90 text-cyan-300 border border-cyan-500/40');
  
  toast.className = `nexa-toast ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'error' ? 'alert-circle' : (type === 'success' ? 'check-circle-2' : 'info')}" class="w-4 h-4 shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 6. AVATAR PICKER IN PROFILE SETUP
function setupAvatarPicker() {
  DOM.modalAvatarList.innerHTML = '';
  state.avatarSeeds.forEach((seed, idx) => {
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-11 h-11 rounded-xl p-0.5 border-2 transition overflow-hidden ${
      idx === 0 ? 'border-cyan-400 scale-105 ring-2 ring-cyan-500/30' : 'border-transparent opacity-60 hover:opacity-100'
    }`;
    btn.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-lg bg-slate-800">`;
    btn.onclick = () => {
      state.selectedAvatarSeed = seed;
      document.querySelectorAll('#modalAvatarList button').forEach(b => {
        b.className = 'w-11 h-11 rounded-xl p-0.5 border-2 border-transparent opacity-60 hover:opacity-100 transition overflow-hidden';
      });
      btn.className = 'w-11 h-11 rounded-xl p-0.5 border-2 border-cyan-400 scale-105 ring-2 ring-cyan-500/30 transition overflow-hidden';
    };
    DOM.modalAvatarList.appendChild(btn);
  });
}

function randomizeAvatars() {
  state.avatarSeeds = state.avatarSeeds.map(() => 'Monkey_' + Math.floor(Math.random() * 99999));
  state.selectedAvatarSeed = state.avatarSeeds[0];
  setupAvatarPicker();
}

// 7. SOCKET.IO CONNECTION & EVENT HANDLING
function initSocketConnection() {
  state.socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  // Socket Connection Status
  state.socket.on('connect', () => {
    DOM.connectionStatusBadge.className = 'flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full ml-2';
    DOM.connectionStatusText.textContent = 'Connected';
  });

  state.socket.on('disconnect', () => {
    DOM.connectionStatusBadge.className = 'flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-full ml-2';
    DOM.connectionStatusText.textContent = 'Reconnecting...';
  });

  // User List update
  state.socket.on('user:list', (users) => {
    state.onlineUsers = users;
    updateOnlinePresenceUI();
  });

  // Channel Message Received
  state.socket.on('channel:message', (msg) => {
    if (!state.channelMessages.has(msg.channelId)) {
      state.channelMessages.set(msg.channelId, []);
    }
    state.channelMessages.get(msg.channelId).push(msg);

    if (state.activeNavTab === 'channels' && state.currentChannel === msg.channelId) {
      appendChatMessage(msg, DOM.chatMessagesFeed);
      if (msg.senderId !== state.currentUser?.id && msg.type !== 'system') {
        soundManager.playReceive();
      }
    }
  });

  // Channel Member Count Update
  state.socket.on('channel:member_count', (data) => {
    const ch = state.channels.find(c => c.id === data.channelId);
    if (ch) {
      ch.memberCount = data.memberCount;
      if (state.activeNavTab === 'channels' && state.currentChannel === data.channelId) {
        DOM.memberCountNumber.textContent = `${data.memberCount} members`;
      }
      renderChannelsList();
    }
  });

  // Channel Typing
  state.socket.on('channel:typing', (data) => {
    if (state.activeNavTab === 'channels' && state.currentChannel === data.channelId) {
      if (data.isTyping) {
        DOM.liveTypingText.textContent = `${data.nickname} is typing...`;
        DOM.liveTypingStrip.classList.remove('opacity-0');
      } else {
        DOM.liveTypingStrip.classList.add('opacity-0');
      }
    }
  });

  // Direct Message Received
  state.socket.on('dm:message', (msg) => {
    const partnerId = msg.senderId === state.currentUser?.id ? msg.receiverId : msg.senderId;
    
    if (!state.dmMessages.has(partnerId)) {
      state.dmMessages.set(partnerId, []);
    }
    state.dmMessages.get(partnerId).push(msg);

    // If active conversation
    if (state.activeNavTab === 'dms' && state.activeDmPartner?.id === partnerId) {
      appendChatMessage(msg, DOM.chatMessagesFeed);
      if (msg.senderId !== state.currentUser?.id) {
        soundManager.playReceive();
        // Emit read receipt
        state.socket.emit('dm:read', { senderId: partnerId });
      }
    } else {
      // Unread badge increment
      if (msg.senderId !== state.currentUser?.id) {
        const count = state.unreadDMs.get(partnerId) || 0;
        state.unreadDMs.set(partnerId, count + 1);
        updateGlobalDmBadge();
        renderOnlineUsersList();
        soundManager.playReceive();
        showToast(`New message from ${msg.senderName}`, 'info');
      }
    }
  });

  // DM Typing
  state.socket.on('dm:typing', (data) => {
    if (state.activeNavTab === 'dms' && state.activeDmPartner?.id === data.senderId) {
      if (data.isTyping) {
        DOM.liveTypingText.textContent = `${data.senderName} is typing...`;
        DOM.liveTypingStrip.classList.remove('opacity-0');
      } else {
        DOM.liveTypingStrip.classList.add('opacity-0');
      }
    }
  });

  // DM Read Receipt
  state.socket.on('dm:read', (data) => {
    if (state.activeNavTab === 'dms' && state.activeDmPartner?.id === data.readBy) {
      document.querySelectorAll('.dm-read-status').forEach(el => {
        el.textContent = '✓✓ Read';
        el.className = 'dm-read-status text-[10px] text-cyan-400 font-semibold';
      });
    }
  });

  // Message Reaction Updated
  state.socket.on('message:reaction', (data) => {
    updateMessageReactionsInDOM(data.messageId, data.reactions);
  });

  // Message Deleted
  state.socket.on('message:delete', (data) => {
    const el = document.getElementById(`msg_${data.messageId}`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.95)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 200);
    }
  });

  // Matchmaking Events
  state.socket.on('match:waiting', () => {
    DOM.strangerSearchingOrb.classList.remove('hidden');
    DOM.strangerActiveChatContainer.classList.add('hidden');
    DOM.strangerHeaderTitle.textContent = 'Searching...';
    DOM.strangerHeaderSubtitle.textContent = 'Looking for someone online';
  });

  state.socket.on('match:found', (data) => {
    state.activeStranger = data.partner;
    DOM.strangerSearchingOrb.classList.add('hidden');
    DOM.strangerActiveChatContainer.classList.remove('hidden');
    
    DOM.strangerHeaderTitle.textContent = data.partner.nickname;
    DOM.strangerHeaderSubtitle.textContent = 'Connected in random chat';
    DOM.strangerPartnerName.textContent = data.partner.nickname;
    DOM.strangerPartnerBio.textContent = data.partner.bio || 'Online stranger';
    DOM.strangerPartnerAvatar.src = data.partner.avatar;

    DOM.strangerMessagesFeed.innerHTML = '';
    appendSystemMessage(`🎉 You are connected with ${data.partner.nickname}! Say hello!`, DOM.strangerMessagesFeed);
    
    soundManager.playMatchFound();
    showToast(`Connected with ${data.partner.nickname}!`, 'success');
  });

  state.socket.on('match:message', (msg) => {
    appendChatMessage(msg, DOM.strangerMessagesFeed);
    if (msg.senderId !== state.currentUser?.id) {
      soundManager.playReceive();
    }
  });

  state.socket.on('match:typing', (data) => {
    if (data.isTyping) {
      DOM.strangerTypingIndicator.classList.remove('opacity-0');
    } else {
      DOM.strangerTypingIndicator.classList.add('opacity-0');
    }
  });

  state.socket.on('match:partner-left', (data) => {
    appendSystemMessage(`⚠️ ${data.message}`, DOM.strangerMessagesFeed);
    DOM.strangerHeaderTitle.textContent = 'Stranger Left';
    DOM.strangerHeaderSubtitle.textContent = 'Click "Next Person" to find another match';
    state.activeStranger = null;
    showToast('Your stranger has left the chat.', 'info');
  });
}

// 8. SIDEBAR & NAVIGATION CONTROLS
function updateOnlinePresenceUI() {
  const count = state.onlineUsers.length;
  DOM.sidebarOnlineCount.textContent = count;
  renderOnlineUsersList();
  renderChannelsList();
}

function renderChannelsList() {
  const filter = DOM.sidebarFilterInput.value.toLowerCase().trim();
  DOM.channelsListContainer.innerHTML = '';

  state.channels
    .filter(ch => ch.name.toLowerCase().includes(filter))
    .forEach(channel => {
      const isActive = state.activeNavTab === 'channels' && state.currentChannel === channel.id;
      const item = document.createElement('div');
      item.className = `p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition select-none ${
        isActive 
          ? 'bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/30' 
          : 'hover:bg-slate-900/60 text-slate-300'
      }`;

      item.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold shrink-0">
            <i data-lucide="${channel.icon || 'hash'}" class="w-3.5 h-3.5"></i>
          </div>
          <div class="truncate">
            <p class="text-xs font-semibold truncate">#${channel.name}</p>
          </div>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">${channel.memberCount || 0}</span>
      `;

      item.onclick = () => switchToChannel(channel.id);
      DOM.channelsListContainer.appendChild(item);
    });

  lucide.createIcons();
}

function renderOnlineUsersList() {
  const filter = DOM.sidebarFilterInput.value.toLowerCase().trim();
  DOM.onlineUsersListContainer.innerHTML = '';

  const otherUsers = state.onlineUsers.filter(u => u.id !== state.currentUser?.id && u.nickname.toLowerCase().includes(filter));

  if (otherUsers.length === 0) {
    DOM.onlineUsersListContainer.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-500">
        No other users online yet.<br><span class="text-[11px] text-slate-600">Open another browser window to test!</span>
      </div>
    `;
    return;
  }

  otherUsers.forEach(user => {
    const isActive = state.activeNavTab === 'dms' && state.activeDmPartner?.id === user.id;
    const unread = state.unreadDMs.get(user.id) || 0;
    const statusClass = user.status === 'away' ? 'status-away' : (user.status === 'busy' ? 'status-busy' : (user.status === 'in-chat' ? 'status-in-chat' : 'status-online'));

    const item = document.createElement('div');
    item.className = `p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition select-none ${
      isActive 
        ? 'bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/30' 
        : 'hover:bg-slate-900/60 text-slate-300'
    }`;

    item.innerHTML = `
      <div class="relative shrink-0">
        <img src="${user.avatar}" class="w-8 h-8 rounded-full bg-slate-800 object-cover border border-slate-700">
        <span class="status-indicator ${statusClass} bottom-0 right-0"></span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold truncate text-slate-200">${escapeHtml(user.nickname)}</p>
          ${unread > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">${unread}</span>` : ''}
        </div>
        <p class="text-[11px] text-slate-400 truncate">${escapeHtml(user.bio || 'Online on MingleMonkey🐒')}</p>
      </div>
    `;

    item.onclick = () => openDirectMessage(user);
    DOM.onlineUsersListContainer.appendChild(item);
  });

  lucide.createIcons();
}

function updateGlobalDmBadge() {
  let total = 0;
  state.unreadDMs.forEach(c => total += c);
  if (total > 0) {
    DOM.globalDmBadge.classList.remove('hidden');
  } else {
    DOM.globalDmBadge.classList.add('hidden');
  }
}

// 9. CONVERSATION SWITCHING
function switchToChannel(channelId) {
  state.activeNavTab = 'channels';
  state.currentChannel = channelId;
  state.activeDmPartner = null;

  DOM.standardChatPane.classList.remove('hidden');
  DOM.strangerChatPane.classList.add('hidden');

  const channel = state.channels.find(c => c.id === channelId) || state.channels[0];
  
  DOM.headerChannelIcon.setAttribute('data-lucide', channel.icon || 'hash');
  DOM.currentChatTitle.textContent = `#${channel.name}`;
  DOM.currentChatTypeBadge.textContent = 'Channel';
  DOM.currentChatTypeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20';
  DOM.currentChatTopic.textContent = channel.topic;
  DOM.memberCountNumber.textContent = `${channel.memberCount || 1} members`;
  DOM.chatMessageInput.placeholder = `Message #${channel.name}... (Enter to send)`;

  DOM.chatMessagesFeed.innerHTML = '';
  DOM.liveTypingStrip.classList.add('opacity-0');

  // Update Right Details Panel
  updateRightDetailsForChannel(channel);

  state.socket.emit('channel:join', channelId, (res) => {
    if (res?.success) {
      if (res.channel) {
        channel.memberCount = res.channel.memberCount;
        DOM.memberCountNumber.textContent = `${res.channel.memberCount} members`;
      }
      if (res.history && res.history.length > 0) {
        res.history.forEach(m => appendChatMessage(m, DOM.chatMessagesFeed, false));
        scrollToBottom(DOM.chatMessagesFeed);
      } else {
        renderEmptyState(`Welcome to #${channel.name}`, 'Be the first to start the conversation!');
      }
    }
  });

  updateNavTabButtons();
  renderChannelsList();
  lucide.createIcons();
}

function openDirectMessage(user) {
  state.activeNavTab = 'dms';
  state.activeDmPartner = user;

  // Clear unread count for this user
  state.unreadDMs.delete(user.id);
  updateGlobalDmBadge();

  DOM.standardChatPane.classList.remove('hidden');
  DOM.strangerChatPane.classList.add('hidden');

  DOM.headerChannelIcon.setAttribute('data-lucide', 'user');
  DOM.currentChatTitle.textContent = `@${user.nickname}`;
  DOM.currentChatTypeBadge.textContent = 'Direct Message';
  DOM.currentChatTypeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20';
  DOM.currentChatTopic.textContent = user.bio || 'Direct 1-on-1 private chat';
  DOM.memberCountNumber.textContent = 'Direct 1-on-1';
  DOM.chatMessageInput.placeholder = `Message @${user.nickname}... (Enter to send)`;

  DOM.chatMessagesFeed.innerHTML = '';
  DOM.liveTypingStrip.classList.add('opacity-0');

  // Update Right Details Panel
  updateRightDetailsForUser(user);

  state.socket.emit('dm:open', user.id, (res) => {
    if (res?.success) {
      if (res.history && res.history.length > 0) {
        res.history.forEach(m => appendChatMessage(m, DOM.chatMessagesFeed, false));
        scrollToBottom(DOM.chatMessagesFeed);
      } else {
        renderEmptyState(`Start chatting with ${user.nickname}`, 'Send a private message to connect in real-time.');
      }
    }
  });

  // Emit read event
  state.socket.emit('dm:read', { senderId: user.id });

  updateNavTabButtons();
  renderOnlineUsersList();
  lucide.createIcons();
}

function startStrangerMatchmaking() {
  state.activeNavTab = 'stranger';
  state.activeDmPartner = null;

  DOM.standardChatPane.classList.add('hidden');
  DOM.strangerChatPane.classList.remove('hidden');

  updateNavTabButtons();
  state.socket.emit('match:find');
}

function updateNavTabButtons() {
  DOM.tabChannels.classList.toggle('active', state.activeNavTab === 'channels');
  DOM.tabDms.classList.toggle('active', state.activeNavTab === 'dms');
  DOM.tabConnect.classList.toggle('active', state.activeNavTab === 'stranger');
}

// 10. MESSAGE RENDERING & ACTIONS
function appendChatMessage(msg, container, autoScroll = true) {
  // Remove empty state if present
  const emptyState = container.querySelector('.empty-state-card');
  if (emptyState) emptyState.remove();

  if (msg.type === 'system') {
    appendSystemMessage(msg.content, container);
    return;
  }

  const isMe = msg.senderId === state.currentUser?.id;
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const wrapper = document.createElement('div');
  wrapper.className = `flex gap-3 message-enter group relative ${isMe ? 'justify-end' : 'justify-start'}`;
  wrapper.id = `msg_${msg.id}`;

  let attachmentHtml = '';
  if (msg.attachment && msg.attachment.data) {
    if (msg.attachment.type?.startsWith('image/')) {
      attachmentHtml = `
        <div class="mt-2 overflow-hidden rounded-xl cursor-pointer max-w-xs shadow-md border border-slate-700/60" onclick="openLightbox('${msg.attachment.data}')">
          <img src="${msg.attachment.data}" class="w-full object-cover max-h-56 rounded-xl hover:scale-105 transition duration-200">
        </div>
      `;
      // Track shared media for details panel
      trackSharedMedia(msg.attachment.data);
    } else {
      attachmentHtml = `
        <a href="${msg.attachment.data}" download="${msg.attachment.name || 'document'}" class="mt-2 flex items-center gap-3 p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl hover:border-cyan-500/50 transition">
          <div class="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <i data-lucide="file-text" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-200 truncate">${escapeHtml(msg.attachment.name || 'document')}</p>
            <p class="text-[10px] text-slate-400">${formatFileSize(msg.attachment.size)} • Click to download</p>
          </div>
        </a>
      `;
    }
  }

  // Reactions HTML
  let reactionsHtml = `<div class="flex flex-wrap gap-1 mt-1 reactions-wrapper" id="reactions_${msg.id}">`;
  if (msg.reactions) {
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (users.length > 0) {
        const isReactedByMe = users.includes(state.currentUser?.nickname);
        reactionsHtml += `
          <button class="reaction-pill ${isReactedByMe ? 'active' : ''}" onclick="handleReactionClick('${msg.id}', '${emoji}')">
            <span>${emoji}</span>
            <span>${users.length}</span>
          </button>
        `;
      }
    }
  }
  reactionsHtml += '</div>';

  // Read status indicator for DMs
  const readStatusHtml = isMe && msg.receiverId ? `
    <span class="dm-read-status text-[10px] ${msg.read ? 'text-cyan-400 font-semibold' : 'text-slate-500'}">
      ${msg.read ? '✓✓ Read' : '✓ Sent'}
    </span>
  ` : '';

  if (isMe) {
    wrapper.innerHTML = `
      <!-- Action Hover Menu -->
      <div class="absolute -top-3.5 right-12 hidden group-hover:flex items-center bg-slate-900 border border-slate-700 rounded-full px-2 py-0.5 shadow-xl gap-1.5 z-10 select-none">
        <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Heart" onclick="handleReactionClick('${msg.id}', '❤️')">❤️</span>
        <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Thumbs Up" onclick="handleReactionClick('${msg.id}', '👍')">👍</span>
        <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Fire" onclick="handleReactionClick('${msg.id}', '🔥')">🔥</span>
        <button class="text-slate-400 hover:text-cyan-400 p-0.5 text-xs" title="Copy Text" onclick="copyMessageText('${escapeJsString(msg.content)}')">
          <i data-lucide="copy" class="w-3 h-3"></i>
        </button>
        <button class="text-slate-400 hover:text-rose-400 p-0.5 text-xs" title="Delete Message" onclick="deleteMessage('${msg.id}')">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>
      </div>

      <div class="flex flex-col items-end max-w-md lg:max-w-xl">
        <div class="flex items-center gap-1.5 mb-1">
          ${readStatusHtml}
          <span class="text-[10px] text-slate-500">${timeStr}</span>
          <span class="text-xs font-bold text-cyan-400">You</span>
        </div>
        <div class="py-2.5 px-4 rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 text-white shadow-md text-sm leading-relaxed break-words border border-cyan-400/20">
          ${escapeHtml(msg.content)}
          ${attachmentHtml}
        </div>
        ${reactionsHtml}
      </div>
      <img src="${msg.senderAvatar || state.currentUser.avatar}" class="w-8 h-8 rounded-full bg-slate-800 object-cover shrink-0 mt-1 border border-cyan-500/40">
    `;
  } else {
    wrapper.innerHTML = `
      <img src="${msg.senderAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + msg.senderId}" class="w-8 h-8 rounded-full bg-slate-800 object-cover shrink-0 mt-1 border border-slate-700">
      <div class="flex flex-col items-start max-w-md lg:max-w-xl">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-xs font-bold text-slate-200">${escapeHtml(msg.senderName || 'User')}</span>
          <span class="text-[10px] text-slate-500">${timeStr}</span>
        </div>
        <div class="py-2.5 px-4 rounded-2xl rounded-tl-sm bg-slate-900 text-slate-100 border border-slate-800 shadow-sm text-sm leading-relaxed break-words group relative">
          ${escapeHtml(msg.content)}
          ${attachmentHtml}

          <!-- Action Hover Menu -->
          <div class="absolute -top-3.5 right-2 hidden group-hover:flex items-center bg-slate-900 border border-slate-700 rounded-full px-2 py-0.5 shadow-xl gap-1.5 z-10 select-none">
            <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Heart" onclick="handleReactionClick('${msg.id}', '❤️')">❤️</span>
            <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Thumbs Up" onclick="handleReactionClick('${msg.id}', '👍')">👍</span>
            <span class="cursor-pointer text-xs hover:scale-125 transition" title="React with Fire" onclick="handleReactionClick('${msg.id}', '🔥')">🔥</span>
            <button class="text-slate-400 hover:text-cyan-400 p-0.5 text-xs" title="Reply" onclick="replyToMessage('${escapeJsString(msg.senderName)}', '${escapeJsString(msg.content)}')">
              <i data-lucide="reply" class="w-3 h-3"></i>
            </button>
            <button class="text-slate-400 hover:text-cyan-400 p-0.5 text-xs" title="Copy Text" onclick="copyMessageText('${escapeJsString(msg.content)}')">
              <i data-lucide="copy" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
        ${reactionsHtml}
      </div>
    `;
  }

  container.appendChild(wrapper);
  lucide.createIcons();
  if (autoScroll) scrollToBottom(container);
}

function appendSystemMessage(text, container) {
  const div = document.createElement('div');
  div.className = 'flex justify-center my-2 message-enter';
  div.innerHTML = `
    <div class="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium flex items-center gap-1.5 shadow-sm">
      <i data-lucide="info" class="w-3.5 h-3.5 text-cyan-400"></i>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
  container.appendChild(div);
  lucide.createIcons();
  scrollToBottom(container);
}

function renderEmptyState(title, subtitle) {
  DOM.chatMessagesFeed.innerHTML = `
    <div class="empty-state-card flex-1 flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px]">
      <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
        <i data-lucide="message-circle" class="w-7 h-7"></i>
      </div>
      <h3 class="text-sm font-bold text-white mb-1">${escapeHtml(title)}</h3>
      <p class="text-xs text-slate-400 max-w-xs">${escapeHtml(subtitle)}</p>
    </div>
  `;
  lucide.createIcons();
}

function updateMessageReactionsInDOM(messageId, reactions) {
  const container = document.getElementById(`reactions_${messageId}`);
  if (!container) return;

  container.innerHTML = '';
  for (const [emoji, users] of Object.entries(reactions)) {
    if (users.length > 0) {
      const isReactedByMe = users.includes(state.currentUser?.nickname);
      const pill = document.createElement('button');
      pill.className = `reaction-pill ${isReactedByMe ? 'active' : ''}`;
      pill.innerHTML = `<span>${emoji}</span><span>${users.length}</span>`;
      pill.onclick = () => handleReactionClick(messageId, emoji);
      container.appendChild(pill);
    }
  }
}

function handleReactionClick(messageId, emoji) {
  if (state.activeNavTab === 'channels') {
    state.socket.emit('message:reaction', {
      channelId: state.currentChannel,
      messageId,
      emoji
    });
  } else if (state.activeNavTab === 'dms' && state.activeDmPartner) {
    state.socket.emit('message:reaction', {
      recipientId: state.activeDmPartner.id,
      messageId,
      emoji
    });
  }
}

function deleteMessage(messageId) {
  if (state.activeNavTab === 'channels') {
    state.socket.emit('message:delete', {
      channelId: state.currentChannel,
      messageId
    });
  } else if (state.activeNavTab === 'dms' && state.activeDmPartner) {
    state.socket.emit('message:delete', {
      recipientId: state.activeDmPartner.id,
      messageId
    });
  }
}

function replyToMessage(senderName, content) {
  DOM.chatMessageInput.value = `> @${senderName}: ${content}\n` + DOM.chatMessageInput.value;
  DOM.chatMessageInput.focus();
}

function copyMessageText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Message copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// 11. DETAILS PANEL UPDATES
function updateRightDetailsForChannel(channel) {
  DOM.detailsAvatar.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${channel.id}`;
  DOM.detailsStatusDot.className = 'status-indicator status-online bottom-0 right-0';
  DOM.detailsTitle.textContent = `#${channel.name}`;
  DOM.detailsSubtitle.textContent = 'Community Public Room';
  DOM.detailsAboutText.textContent = channel.topic;
  clearSharedMediaList();
}

function updateRightDetailsForUser(user) {
  DOM.detailsAvatar.src = user.avatar;
  const statusClass = user.status === 'away' ? 'status-away' : (user.status === 'busy' ? 'status-busy' : 'status-online');
  DOM.detailsStatusDot.className = `status-indicator ${statusClass} bottom-0 right-0`;
  DOM.detailsTitle.textContent = `@${user.nickname}`;
  DOM.detailsSubtitle.textContent = user.status ? user.status.toUpperCase() : 'ONLINE';
  DOM.detailsAboutText.textContent = user.bio || 'Direct private connection';
  clearSharedMediaList();
}

function clearSharedMediaList() {
  state.sharedMedia = [];
  DOM.detailsMediaCount.textContent = '0 items';
  DOM.detailsMediaGrid.innerHTML = `<div class="col-span-3 text-center py-4 text-xs text-slate-500">No media shared yet</div>`;
}

function trackSharedMedia(url) {
  if (!state.sharedMedia.includes(url)) {
    state.sharedMedia.push(url);
    DOM.detailsMediaCount.textContent = `${state.sharedMedia.length} items`;
    
    if (state.sharedMedia.length === 1) {
      DOM.detailsMediaGrid.innerHTML = '';
    }

    const img = document.createElement('img');
    img.src = url;
    img.className = 'w-full h-16 object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-80 transition';
    img.onclick = () => openLightbox(url);
    DOM.detailsMediaGrid.appendChild(img);
  }
}

// 12. EVENT LISTENERS
function setupEventListeners() {
  // Profile Setup Form Submit
  DOM.setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = DOM.modalNicknameInput.value.trim();
    const bio = DOM.modalBioInput.value.trim() || 'Ready to chat on MingleMonkey🐒!';
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${state.selectedAvatarSeed}`;

    if (!nickname) {
      DOM.setupErrorMsg.textContent = 'Please enter a nickname';
      DOM.setupErrorMsg.classList.remove('hidden');
      return;
    }

    state.socket.emit('user:join', { nickname, avatar, bio }, (res) => {
      if (res?.success) {
        state.currentUser = res.user;
        DOM.headerUserAvatar.src = avatar;
        DOM.headerUserName.textContent = nickname;
        DOM.sidebarUserAvatar.src = avatar;
        DOM.sidebarUsername.textContent = nickname;
        DOM.sidebarUserBio.textContent = bio;

        DOM.setupModal.classList.add('hidden');
        showToast(`Welcome to MingleMonkey🐒, ${nickname}!`, 'success');

        // Join default #general channel
        switchToChannel('general');
      } else {
        DOM.setupErrorMsg.textContent = res?.error || 'Failed to join';
        DOM.setupErrorMsg.classList.remove('hidden');
      }
    });
  });

  DOM.modalRandomizeAvatars.addEventListener('click', randomizeAvatars);

  // Nav Switchers
  DOM.tabChannels.addEventListener('click', () => {
    state.activeNavTab = 'channels';
    switchToChannel('general');
  });

  DOM.tabDms.addEventListener('click', () => {
    state.activeNavTab = 'dms';
    updateNavTabButtons();
    if (state.onlineUsers.length > 1) {
      const firstOther = state.onlineUsers.find(u => u.id !== state.currentUser?.id);
      if (firstOther) openDirectMessage(firstOther);
    }
  });

  DOM.tabConnect.addEventListener('click', startStrangerMatchmaking);
  DOM.quickConnectBanner.addEventListener('click', startStrangerMatchmaking);

  // Sidebar Filter Input
  DOM.sidebarFilterInput.addEventListener('input', () => {
    renderChannelsList();
    renderOnlineUsersList();
  });

  // Global In-Chat Search
  DOM.globalSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.message-enter').forEach(msgEl => {
      if (!q) {
        msgEl.style.display = 'flex';
        msgEl.classList.remove('ring-2', 'ring-cyan-400/50');
      } else if (msgEl.textContent.toLowerCase().includes(q)) {
        msgEl.style.display = 'flex';
        msgEl.classList.add('ring-2', 'ring-cyan-400/50');
      } else {
        msgEl.style.display = 'none';
      }
    });
  });

  // User Status Selector
  DOM.sidebarStatusSelect.addEventListener('change', (e) => {
    const status = e.target.value;
    const statusClass = status === 'away' ? 'status-away' : (status === 'busy' ? 'status-busy' : 'status-online');
    DOM.sidebarStatusDot.className = `status-indicator ${statusClass} bottom-0 right-0`;
    state.socket.emit('user:status', status);
  });

  // Sound Toggle
  DOM.soundBtn.addEventListener('click', () => {
    soundManager.enabled = !soundManager.enabled;
    localStorage.setItem('nexa_sound', soundManager.enabled);
    setupSoundButtonUI();
    showToast(soundManager.enabled ? 'Sound notifications ON' : 'Sound notifications MUTED', 'info');
  });

  // Theme Toggle
  DOM.themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('nexa_theme', isDark ? 'dark' : 'light');
    setupThemeState();
  });

  // Details Panel Toggle
  DOM.toggleDetailsBtn.addEventListener('click', () => {
    DOM.rightDetailsPanel.classList.toggle('hidden');
    DOM.rightDetailsPanel.classList.toggle('xl:flex');
  });

  DOM.closeDetailsPanelBtn.addEventListener('click', () => {
    DOM.rightDetailsPanel.classList.add('hidden');
    DOM.rightDetailsPanel.classList.remove('xl:flex');
  });

  // Mobile Drawer Toggle
  DOM.mobileSidebarToggle.addEventListener('click', () => {
    DOM.mainSidebar.classList.toggle('-translate-x-full');
  });

  // Form Submit (Standard Chat)
  DOM.mainChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.chatMessageInput.value.trim();
    const attachment = state.attachedFile;

    if (!text && !attachment) return;

    if (state.activeNavTab === 'channels') {
      state.socket.emit('channel:message', {
        channelId: state.currentChannel,
        content: text,
        attachment
      });
    } else if (state.activeNavTab === 'dms' && state.activeDmPartner) {
      state.socket.emit('dm:message', {
        recipientId: state.activeDmPartner.id,
        content: text,
        attachment
      });
    }

    soundManager.playSend();

    DOM.chatMessageInput.value = '';
    clearFileAttachment();
    DOM.emojiPickerDrawer.classList.add('hidden');
    emitTypingSignal(false);
  });

  // Form Submit (Stranger Chat)
  DOM.strangerChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.strangerMessageInput.value.trim();
    if (!text) return;

    state.socket.emit('match:message', { content: text });
    soundManager.playSend();
    DOM.strangerMessageInput.value = '';
    state.socket.emit('match:typing', { isTyping: false });
  });

  // Stranger Controls
  DOM.strangerNextPersonBtn.addEventListener('click', () => {
    state.socket.emit('match:next');
  });

  DOM.strangerExitBtn.addEventListener('click', () => {
    state.socket.emit('match:leave');
    switchToChannel('general');
  });

  DOM.cancelSearchingStrangerBtn.addEventListener('click', () => {
    state.socket.emit('match:leave');
    switchToChannel('general');
  });

  // Clear Chat History View
  DOM.clearChatHistoryBtn.addEventListener('click', () => {
    DOM.chatMessagesFeed.innerHTML = '';
    renderEmptyState('View cleared', 'New incoming messages will appear here.');
  });

  // Typing state for chat input
  DOM.chatMessageInput.addEventListener('input', () => {
    emitTypingSignal(true);
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      emitTypingSignal(false);
    }, 1500);
  });

  // Typing state for stranger input
  DOM.strangerMessageInput.addEventListener('input', () => {
    state.socket.emit('match:typing', { isTyping: true });
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      state.socket.emit('match:typing', { isTyping: false });
    }, 1500);
  });

  // Emoji Drawer Toggle
  DOM.toggleEmojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.emojiPickerDrawer.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!DOM.emojiPickerDrawer.contains(e.target) && e.target !== DOM.toggleEmojiBtn) {
      DOM.emojiPickerDrawer.classList.add('hidden');
    }
  });

  DOM.emojiGridButtons.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-btn')) {
      DOM.chatMessageInput.value += e.target.textContent;
      DOM.chatMessageInput.focus();
    }
  });

  // File Upload Handlers
  DOM.attachFileBtn.addEventListener('click', () => DOM.fileAttachmentInput.click());

  DOM.fileAttachmentInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File exceeds 5MB maximum limit', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      state.attachedFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: ev.target.result
      };

      DOM.previewFileName.textContent = file.name;
      DOM.previewFileSize.textContent = formatFileSize(file.size);

      if (file.type.startsWith('image/')) {
        DOM.previewImageElement.src = ev.target.result;
        DOM.previewImageElement.classList.remove('hidden');
        DOM.previewDocIcon.classList.add('hidden');
      } else {
        DOM.previewImageElement.classList.add('hidden');
        DOM.previewDocIcon.classList.remove('hidden');
      }

      DOM.inputAttachmentBar.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  DOM.cancelAttachmentBtn.addEventListener('click', clearFileAttachment);

  // Lightbox Close
  DOM.imageLightboxModal.addEventListener('click', () => {
    DOM.imageLightboxModal.classList.add('hidden');
    DOM.imageLightboxModal.classList.remove('flex');
  });
}

function clearFileAttachment() {
  state.attachedFile = null;
  DOM.fileAttachmentInput.value = '';
  DOM.inputAttachmentBar.classList.add('hidden');
}

function emitTypingSignal(isTyping) {
  if (state.activeNavTab === 'channels') {
    state.socket.emit('channel:typing', {
      channelId: state.currentChannel,
      isTyping
    });
  } else if (state.activeNavTab === 'dms' && state.activeDmPartner) {
    state.socket.emit('dm:typing', {
      recipientId: state.activeDmPartner.id,
      isTyping
    });
  }
}

// 13. UI HELPER UTILITIES
function openLightbox(url) {
  DOM.lightboxImageElement.src = url;
  DOM.imageLightboxModal.classList.remove('hidden');
  DOM.imageLightboxModal.classList.add('flex');
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function setupSoundButtonUI() {
  DOM.soundBtnIcon.setAttribute('data-lucide', soundManager.enabled ? 'volume-2' : 'volume-x');
  DOM.soundBtn.classList.toggle('text-rose-400', !soundManager.enabled);
  lucide.createIcons();
}

function setupThemeState() {
  const saved = localStorage.getItem('mingle_theme') || localStorage.getItem('nexa_theme') || 'dark';
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    DOM.themeBtnIcon.setAttribute('data-lucide', 'sun');
  } else {
    document.documentElement.classList.remove('dark');
    DOM.themeBtnIcon.setAttribute('data-lucide', 'moon');
  }
  lucide.createIcons();
}

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', initializeMingleMonkey);
