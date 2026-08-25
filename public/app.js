/**
 * MINGLE 🐒 — Social Discovery & Real-Time Messaging Engine
 */

// 1. SOUND EFFECTS SYNTHESIZER
class MingleSoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('mingle_sound') !== 'false';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
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

  playMingleConnect() {
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
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.22);
      });
    } catch(e) {}
  }
}

const sounds = new MingleSoundFx();

// 2. CLIENT APPLICATION STATE
const state = {
  socket: null,
  currentUser: null, // { id, username, displayName, avatar, bio, status, mingleStatus, privacySettings }
  activeSection: 'home', // 'home' | 'chats' | 'discover' | 'online' | 'mingled' | 'surprise'
  activeChatPartner: null, // user profile object
  activeSurprisePartner: null,
  minglesList: [],
  onlineMinglers: [],
  threads: [],
  unreadTotal: 0,
  attachedFile: null,
  customAvatarDataUrl: null,
  settingsAvatarDataUrl: null,
  typingTimer: null,
  usernameCheckTimer: null,
  topSearchTimer: null,
  avatarSeeds: ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Kabir', 'Diya', 'Arjun', 'Meera'],
  selectedAvatarSeed: 'Aarav'
};

// 3. DOM ELEMENTS
const DOM = {
  toastContainer: document.getElementById('toastContainer'),

  // Auth Modal
  authModal: document.getElementById('authModal'),
  authTabRegister: document.getElementById('authTabRegister'),
  authTabLogin: document.getElementById('authTabLogin'),
  registerForm: document.getElementById('registerForm'),
  loginForm: document.getElementById('loginForm'),
  regAvatarPreviewContainer: document.getElementById('regAvatarPreviewContainer'),
  regPhotoPreview: document.getElementById('regPhotoPreview'),
  regPhotoUploadInput: document.getElementById('regPhotoUploadInput'),
  regUploadPhotoBtn: document.getElementById('regUploadPhotoBtn'),
  toggleAvatarsListBtn: document.getElementById('toggleAvatarsListBtn'),
  collapsibleAvatarSection: document.getElementById('collapsibleAvatarSection'),
  registerAvatarList: document.getElementById('registerAvatarList'),
  randomizeAvatarsBtn: document.getElementById('randomizeAvatarsBtn'),
  regUsernameInput: document.getElementById('regUsernameInput'),
  regDisplayNameInput: document.getElementById('regDisplayNameInput'),
  regPasswordInput: document.getElementById('regPasswordInput'),
  toggleRegPasswordBtn: document.getElementById('toggleRegPasswordBtn'),
  regPasswordEyeIcon: document.getElementById('regPasswordEyeIcon'),
  regBioInput: document.getElementById('regBioInput'),
  regErrorMsg: document.getElementById('regErrorMsg'),
  createIdentityBtn: document.getElementById('createIdentityBtn'),
  createIdBtnText: document.getElementById('createIdBtnText'),
  usernameCheckIcon: document.getElementById('usernameCheckIcon'),
  usernameFeedback: document.getElementById('usernameFeedback'),
  loginUsernameInput: document.getElementById('loginUsernameInput'),
  loginPasswordInput: document.getElementById('loginPasswordInput'),
  toggleLoginPasswordBtn: document.getElementById('toggleLoginPasswordBtn'),
  loginPasswordEyeIcon: document.getElementById('loginPasswordEyeIcon'),
  loginErrorMsg: document.getElementById('loginErrorMsg'),

  // Top Header
  mobileMenuToggle: document.getElementById('mobileMenuToggle'),
  brandLogoHome: document.getElementById('brandLogoHome'),
  topSearchInput: document.getElementById('topSearchInput'),
  topSearchDropdown: document.getElementById('topSearchDropdown'),
  userMingleStatusSelect: document.getElementById('userMingleStatusSelect'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  headerUserChip: document.getElementById('headerUserChip'),
  headerAvatar: document.getElementById('headerAvatar'),
  headerStatusDot: document.getElementById('headerStatusDot'),
  headerDisplayName: document.getElementById('headerDisplayName'),
  headerUsername: document.getElementById('headerUsername'),

  // Left Nav Sidebar
  mainNavSidebar: document.getElementById('mainNavSidebar'),
  navBtnHome: document.getElementById('navBtnHome'),
  navBtnChats: document.getElementById('navBtnChats'),
  navChatsBadge: document.getElementById('navChatsBadge'),
  navBtnDiscover: document.getElementById('navBtnDiscover'),
  navBtnOnline: document.getElementById('navBtnOnline'),
  navOnlineBadge: document.getElementById('navOnlineBadge'),
  navBtnMingled: document.getElementById('navBtnMingled'),
  navMingledBadge: document.getElementById('navMingledBadge'),
  quickSurpriseBanner: document.getElementById('quickSurpriseBanner'),
  sidebarThreadsContainer: document.getElementById('sidebarThreadsContainer'),
  footerProfileBtn: document.getElementById('footerProfileBtn'),
  footerAvatar: document.getElementById('footerAvatar'),
  footerDisplayName: document.getElementById('footerDisplayName'),
  footerUsername: document.getElementById('footerUsername'),
  profileSettingsBtn: document.getElementById('profileSettingsBtn'),

  // Workpanes
  sectionHomePane: document.getElementById('sectionHomePane'),
  sectionChatsPane: document.getElementById('sectionChatsPane'),
  sectionDiscoverPane: document.getElementById('sectionDiscoverPane'),
  sectionOnlinePane: document.getElementById('sectionOnlinePane'),
  sectionMingledPane: document.getElementById('sectionMingledPane'),
  sectionSurprisePane: document.getElementById('sectionSurprisePane'),

  // Home Elements
  homeHeroName: document.getElementById('homeHeroName'),
  homeStatOnlineMingles: document.getElementById('homeStatOnlineMingles'),
  homeStatTotalMingles: document.getElementById('homeStatTotalMingles'),
  homeStatTotalOnline: document.getElementById('homeStatTotalOnline'),
  homeOnlineMinglesGrid: document.getElementById('homeOnlineMinglesGrid'),
  homeViewAllMingledBtn: document.getElementById('homeViewAllMingledBtn'),
  homeDiscoverBtn: document.getElementById('homeDiscoverBtn'),
  homeSurpriseBtn: document.getElementById('homeSurpriseBtn'),
  mobileStoriesReel: document.getElementById('mobileStoriesReel'),

  // Active Chat Elements
  chatPartnerAvatar: document.getElementById('chatPartnerAvatar'),
  chatPartnerStatusDot: document.getElementById('chatPartnerStatusDot'),
  chatPartnerDisplayName: document.getElementById('chatPartnerDisplayName'),
  chatPartnerUsername: document.getElementById('chatPartnerUsername'),
  chatMingleStateBadge: document.getElementById('chatMingleStateBadge'),
  chatPartnerBio: document.getElementById('chatPartnerBio'),
  chatToggleMingleBtn: document.getElementById('chatToggleMingleBtn'),
  chatProfileToggleBtn: document.getElementById('chatProfileToggleBtn'),
  clearChatViewBtn: document.getElementById('clearChatViewBtn'),
  chatMessagesStream: document.getElementById('chatMessagesStream'),
  chatTypingIndicator: document.getElementById('chatTypingIndicator'),
  chatTypingText: document.getElementById('chatTypingText'),
  chatAttachmentPreviewBar: document.getElementById('chatAttachmentPreviewBar'),
  attachmentImagePreview: document.getElementById('attachmentImagePreview'),
  attachmentDocIcon: document.getElementById('attachmentDocIcon'),
  attachmentNameText: document.getElementById('attachmentNameText'),
  attachmentSizeText: document.getElementById('attachmentSizeText'),
  cancelChatAttachmentBtn: document.getElementById('cancelChatAttachmentBtn'),
  chatEmojiDrawer: document.getElementById('chatEmojiDrawer'),
  chatEmojiToggleBtn: document.getElementById('chatEmojiToggleBtn'),
  chatEmojiGrid: document.getElementById('chatEmojiGrid'),
  activeChatForm: document.getElementById('activeChatForm'),
  chatFileInput: document.getElementById('chatFileInput'),
  chatAttachBtn: document.getElementById('chatAttachBtn'),
  chatTextInput: document.getElementById('chatTextInput'),

  // Discover & Online
  discoverSearchInput: document.getElementById('discoverSearchInput'),
  discoverResultsContainer: document.getElementById('discoverResultsContainer'),
  onlinePeopleGrid: document.getElementById('onlinePeopleGrid'),
  refreshOnlineBtn: document.getElementById('refreshOnlineBtn'),
  mingledCountPill: document.getElementById('mingledCountPill'),
  mingledNetworkGrid: document.getElementById('mingledNetworkGrid'),

  // Surprise Elements
  surpriseHeaderTitle: document.getElementById('surpriseHeaderTitle'),
  surpriseHeaderSubtitle: document.getElementById('surpriseHeaderSubtitle'),
  surpriseMingleNowBtn: document.getElementById('surpriseMingleNowBtn'),
  surpriseNextBtn: document.getElementById('surpriseNextBtn'),
  surpriseExitBtn: document.getElementById('surpriseExitBtn'),
  surpriseRadarState: document.getElementById('surpriseRadarState'),
  cancelSurpriseSearchBtn: document.getElementById('cancelSurpriseSearchBtn'),
  surpriseActiveChatState: document.getElementById('surpriseActiveChatState'),
  surprisePartnerAvatar: document.getElementById('surprisePartnerAvatar'),
  surprisePartnerName: document.getElementById('surprisePartnerName'),
  surprisePartnerUsername: document.getElementById('surprisePartnerUsername'),
  surprisePartnerBio: document.getElementById('surprisePartnerBio'),
  surpriseMessagesStream: document.getElementById('surpriseMessagesStream'),
  surpriseTypingStrip: document.getElementById('surpriseTypingStrip'),
  surpriseChatForm: document.getElementById('surpriseChatForm'),
  surpriseTextInput: document.getElementById('surpriseTextInput'),

  // Right Side & Profile Drawer
  rightSidebar: document.getElementById('rightSidebar'),
  rightCommunityWidgets: document.getElementById('rightCommunityWidgets'),
  rightProfileDrawer: document.getElementById('rightProfileDrawer'),
  closeRightDrawerBtn: document.getElementById('closeRightDrawerBtn'),
  drawerAvatar: document.getElementById('drawerAvatar'),
  drawerStatusDot: document.getElementById('drawerStatusDot'),
  drawerDisplayName: document.getElementById('drawerDisplayName'),
  drawerUsername: document.getElementById('drawerUsername'),
  drawerLastSeen: document.getElementById('drawerLastSeen'),
  drawerMingleBtn: document.getElementById('drawerMingleBtn'),
  drawerMessageBtn: document.getElementById('drawerMessageBtn'),
  drawerBio: document.getElementById('drawerBio'),
  drawerMinglesCount: document.getElementById('drawerMinglesCount'),
  drawerMingleStatusText: document.getElementById('drawerMingleStatusText'),
  drawerMediaCount: document.getElementById('drawerMediaCount'),
  drawerMediaGrid: document.getElementById('drawerMediaGrid'),

  // Settings Modal
  profileSettingsModal: document.getElementById('profileSettingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  updateProfileForm: document.getElementById('updateProfileForm'),
  settingsPhotoContainer: document.getElementById('settingsPhotoContainer'),
  settingsPhotoPreview: document.getElementById('settingsPhotoPreview'),
  settingsPhotoUploadInput: document.getElementById('settingsPhotoUploadInput'),
  settingsUploadPhotoBtn: document.getElementById('settingsUploadPhotoBtn'),
  settingsModalUsername: document.getElementById('settingsModalUsername'),
  settingsDisplayNameInput: document.getElementById('settingsDisplayNameInput'),
  settingsBioInput: document.getElementById('settingsBioInput'),
  settingShowOnlineStatus: document.getElementById('settingShowOnlineStatus'),
  settingAllowSurpriseMingle: document.getElementById('settingAllowSurpriseMingle'),
  settingAllowNonMingleMessages: document.getElementById('settingAllowNonMingleMessages'),
  switchAccountBtn: document.getElementById('switchAccountBtn'),

  // Lightbox
  imageLightboxModal: document.getElementById('imageLightboxModal'),
  lightboxImageElement: document.getElementById('lightboxImageElement'),

  // Mobile Bottom Navigation & Responsive
  mobileBottomNav: document.getElementById('mobileBottomNav'),
  mobileNavHome: document.getElementById('mobileNavHome'),
  mobileNavDiscover: document.getElementById('mobileNavDiscover'),
  mobileNavChats: document.getElementById('mobileNavChats'),
  mobileNavChatsBadge: document.getElementById('mobileNavChatsBadge'),
  mobileNavSurprise: document.getElementById('mobileNavSurprise'),
  mobileNavProfile: document.getElementById('mobileNavProfile'),
  mobileNavAvatar: document.getElementById('mobileNavAvatar'),
  mobileSidebarBackdrop: document.getElementById('mobileSidebarBackdrop'),
  chatMobileBackBtn: document.getElementById('chatMobileBackBtn')
};

// 4. INITIALIZATION
function initApp() {
  try {
    setupEventListeners();
  } catch (e) {
    console.error('Error setting up event listeners:', e);
  }

  try {
    setupAvatarPicker();
  } catch (e) {}

  try {
    setupSoundUI();
  } catch (e) {}

  try {
    setupTheme();
  } catch (e) {}

  try {
    if (window.lucide) if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  } catch (e) {}

  try {
    initSocket();
  } catch (e) {}

  try {
    checkExistingSession();
  } catch (e) {}

  // Periodic real-time sync across devices & serverless environments
  setInterval(() => {
    if (state.currentUser && state.currentUser.id) {
      if (state.activeSection === 'home') loadHomeData();
      if (state.activeSection === 'online') loadOnlinePeople();
      if (state.activeSection === 'mingled') loadMingledNetwork();
      if (state.activeSection === 'chats' && state.activeChatPartner) {
        pollChatMessages();
      }
    }
  }, 3000);
}

async function pollChatMessages() {
  if (!state.activeChatPartner || !state.currentUser) return;
  try {
    const resp = await fetch(`/api/messages?userId=${state.currentUser.id}&partnerId=${state.activeChatPartner.id}`);
    const res = await resp.json();
    if (res?.success && res?.messages) {
      res.messages.forEach(msg => {
        const existing = document.querySelector(`[data-msg-id="${msg.id}"]`);
        if (!existing) {
          appendChatMessage(msg, DOM.chatMessagesStream);
          if (msg.senderId !== state.currentUser.id) {
            sounds.playReceive();
          }
        }
      });
    }
  } catch(e) {}
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgClass = type === 'error' 
    ? 'bg-rose-50 text-rose-600 border border-rose-200' 
    : (type === 'success' ? 'bg-rose-50 text-[#FF5A5F] border border-rose-200' : 'bg-white text-gray-800 border border-gray-200');
  
  toast.className = `mingle-toast ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'error' ? 'alert-circle' : (type === 'success' ? 'sparkles' : 'info')}" class="w-4 h-4 shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// 5. SESSION & IDENTITY SETUP
function showAuthModal(tab = 'register') {
  DOM.authModal.classList.remove('hidden');
  DOM.authModal.classList.add('flex');
  DOM.authModal.style.setProperty('display', 'flex', 'important');
  if (tab === 'login') {
    DOM.authTabLogin.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-white btn-coral shadow-sm';
    DOM.authTabRegister.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-gray-500 hover:text-gray-900';
    DOM.loginForm.classList.remove('hidden');
    DOM.registerForm.classList.add('hidden');
  } else {
    DOM.authTabRegister.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-white btn-coral shadow-sm';
    DOM.authTabLogin.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition text-gray-500 hover:text-gray-900';
    DOM.registerForm.classList.remove('hidden');
    DOM.loginForm.classList.add('hidden');
  }
  if (DOM.regErrorMsg) DOM.regErrorMsg.classList.add('hidden');
  if (DOM.loginErrorMsg) DOM.loginErrorMsg.classList.add('hidden');
}

function hideAuthModal() {
  DOM.authModal.classList.add('hidden');
  DOM.authModal.classList.remove('flex');
  DOM.authModal.style.setProperty('display', 'none', 'important');
}

function checkExistingSession() {
  const savedUserJson = localStorage.getItem('mingle_user');
  if (savedUserJson) {
    try {
      const user = JSON.parse(savedUserJson);
      if (user && (user.id || user.username)) {
        setCurrentUser(user);
        hideAuthModal();

        // Silently sync session with server in background
        if (typeof fetch !== 'undefined') {
          fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, sessionToken: user.sessionToken })
          })
          .then(r => r.json())
          .then(res => {
            if (res?.success && res?.user) {
              setCurrentUser(res.user);
              if (state.socket && state.socket.connected) {
                state.socket.emit('user:restore_session', { userId: res.user.id, sessionToken: res.user.sessionToken });
              }
            }
          })
          .catch(() => {});
        }
        return;
      }
    } catch (e) {}
  }
  showAuthModal('register');
}

function setCurrentUser(user) {
  if (!user) return;
  state.currentUser = user;
  localStorage.setItem('mingle_user', JSON.stringify(user));
  hideAuthModal();

  // Update Top Bar & Footers & Mobile Nav
  if (DOM.headerAvatar) DOM.headerAvatar.src = user.avatar;
  if (DOM.headerDisplayName) DOM.headerDisplayName.textContent = user.displayName;
  if (DOM.headerUsername) DOM.headerUsername.textContent = `@${user.username}`;
  if (DOM.footerAvatar) DOM.footerAvatar.src = user.avatar;
  if (DOM.footerDisplayName) DOM.footerDisplayName.textContent = user.displayName;
  if (DOM.footerUsername) DOM.footerUsername.textContent = `@${user.username}`;
  if (DOM.homeHeroName) DOM.homeHeroName.textContent = user.displayName;
  if (DOM.mobileNavAvatar) DOM.mobileNavAvatar.src = user.avatar;

  if (DOM.userMingleStatusSelect) DOM.userMingleStatusSelect.value = user.mingleStatus || 'available';

  // Switch to home & load data
  switchSection('home');
  loadHomeData();
  refreshThreads();
}

function setupAvatarPicker() {
  DOM.registerAvatarList.innerHTML = '';
  state.avatarSeeds.forEach((seed, idx) => {
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-10 h-10 rounded-xl p-0.5 border-2 transition overflow-hidden ${
      idx === 0 && !state.customAvatarDataUrl ? 'border-[#FF5A5F] scale-105 ring-2 ring-[#FF5A5F]/30' : 'border-transparent opacity-60 hover:opacity-100'
    }`;
    btn.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-lg bg-gray-100">`;
    btn.onclick = () => {
      state.selectedAvatarSeed = seed;
      state.customAvatarDataUrl = null;
      DOM.regPhotoPreview.src = url;
      document.querySelectorAll('#registerAvatarList button').forEach(b => {
        b.className = 'w-10 h-10 rounded-xl p-0.5 border-2 border-transparent opacity-60 hover:opacity-100 transition overflow-hidden';
      });
      btn.className = 'w-10 h-10 rounded-xl p-0.5 border-2 border-[#FF5A5F] scale-105 ring-2 ring-[#FF5A5F]/30 transition overflow-hidden';
    };
    DOM.registerAvatarList.appendChild(btn);
  });
}

function randomizeAvatars() {
  state.avatarSeeds = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Kabir', 'Diya', 'Arjun', 'Meera', 'Vikram', 'Neha'].sort(() => Math.random() - 0.5);
  state.selectedAvatarSeed = state.avatarSeeds[0];
  state.customAvatarDataUrl = null;
  DOM.regPhotoPreview.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.selectedAvatarSeed}`;
  setupAvatarPicker();
}

// 6. SOCKET.IO EVENTS & SYNCHRONIZATION
function initSocket() {
  if (state.socket) return;
  if (typeof io !== 'function') {
    console.warn('Socket.io not loaded, running in resilient mode');
    return;
  }
  const SERVER_URL = (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) 
    ? window.location.origin 
    : 'http://localhost:3000';

  state.socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 50,
    reconnectionDelay: 500,
    timeout: 10000
  });

  state.socket.on('connect', () => {
    console.log('✅ Socket connected to Mingle server:', state.socket.id);
    if (state.currentUser && (state.currentUser.id || state.currentUser.username)) {
      state.socket.emit('user:restore_session', {
        userId: state.currentUser.id,
        sessionToken: state.currentUser.sessionToken
      });
    }
  });

  state.socket.on('connect_error', (err) => {
    // Graceful silent fallback
  });

  // Real-time presence change from network
  state.socket.on('user:presence_changed', (data) => {
    // If we're looking at online people or home, refresh
    if (state.activeSection === 'home') loadHomeData();
    if (state.activeSection === 'online') loadOnlinePeople();
    if (state.activeSection === 'mingled') loadMingledNetwork();

    // If chat partner updated
    if (state.activeChatPartner && state.activeChatPartner.id === data.userId) {
      state.activeChatPartner.isOnline = data.isOnline;
      state.activeChatPartner.lastSeen = data.lastSeen;
      updateChatHeaderPresence(state.activeChatPartner);
    }
  });

  // Direct Message Received
  state.socket.on('dm:message', (msg) => {
    const isMe = msg.senderId === state.currentUser?.id;
    const partnerId = isMe ? msg.receiverId : msg.senderId;

    if (state.activeSection === 'chats' && state.activeChatPartner?.id === partnerId) {
      appendChatMessage(msg, DOM.chatMessagesStream);
      if (!isMe) {
        sounds.playReceive();
        state.socket.emit('dm:read', { senderId: partnerId });
      }
    } else {
      if (!isMe) {
        sounds.playReceive();
        showToast(`💬 Message from ${msg.senderDisplayName}`, 'info');
      }
    }
    refreshThreads();
  });

  // Typing signal
  state.socket.on('dm:typing', (data) => {
    if (state.activeSection === 'chats' && state.activeChatPartner?.id === data.senderId) {
      if (data.isTyping) {
        DOM.chatTypingText.textContent = `${data.senderDisplayName} is typing...`;
        DOM.chatTypingIndicator.classList.remove('opacity-0');
      } else {
        DOM.chatTypingIndicator.classList.add('opacity-0');
      }
    }
  });

  // Read receipt
  state.socket.on('dm:read', (data) => {
    if (state.activeSection === 'chats' && state.activeChatPartner?.id === data.readBy) {
      document.querySelectorAll('.msg-read-status').forEach(el => {
        el.textContent = '✓✓ Read';
        el.className = 'msg-read-status text-[10px] text-amber-400 font-semibold';
      });
    }
  });

  // Mingle notification when someone mingles with us
  state.socket.on('user:mingled_by', (data) => {
    sounds.playMingleConnect();
    showToast(`🎉 @${data.mingler.username} mingled with you!`, 'success');
    loadHomeData();
    if (state.activeSection === 'mingled') loadMingledNetwork();
    if (state.activeChatPartner && state.activeChatPartner.id === data.mingler.id) {
      state.activeChatPartner.isMingled = true;
      updateChatHeaderPresence(state.activeChatPartner);
    }
  });

  state.socket.on('user:unmingled_by', (data) => {
    showToast(`Unmingled connection removed`, 'info');
    loadHomeData();
    if (state.activeSection === 'mingled') loadMingledNetwork();
    if (state.activeChatPartner && state.activeChatPartner.id === data.unminglerId) {
      state.activeChatPartner.isMingled = false;
      updateChatHeaderPresence(state.activeChatPartner);
    }
  });

  // Surprise Mingle Events
  state.socket.on('surprise:waiting', () => {
    DOM.surpriseRadarState.classList.remove('hidden');
    DOM.surpriseActiveChatState.classList.add('hidden');
    DOM.surpriseMingleNowBtn.classList.add('hidden');
  });

  state.socket.on('surprise:matched', (data) => {
    state.activeSurprisePartner = data.partner;
    DOM.surpriseRadarState.classList.add('hidden');
    DOM.surpriseActiveChatState.classList.remove('hidden');
    DOM.surpriseMingleNowBtn.classList.remove('hidden');

    DOM.surprisePartnerAvatar.src = data.partner.avatar;
    DOM.surprisePartnerName.textContent = data.partner.displayName;
    DOM.surprisePartnerUsername.textContent = `@${data.partner.username}`;
    DOM.surprisePartnerBio.textContent = data.partner.bio || 'Surprise Mingle Match';

    DOM.surpriseMessagesStream.innerHTML = '';
    appendSystemMessage(`✨ You are connected with ${data.partner.displayName} (@${data.partner.username})! Say hello or click Mingle to connect permanently.`, DOM.surpriseMessagesStream);

    sounds.playMingleConnect();
    showToast(`Connected with @${data.partner.username}!`, 'success');
  });

  state.socket.on('surprise:message', (msg) => {
    appendChatMessage(msg, DOM.surpriseMessagesStream);
    if (msg.senderId !== state.currentUser?.id) {
      sounds.playReceive();
    }
  });

  state.socket.on('surprise:typing', (data) => {
    if (data.isTyping) {
      DOM.surpriseTypingStrip.classList.remove('opacity-0');
    } else {
      DOM.surpriseTypingStrip.classList.add('opacity-0');
    }
  });

  state.socket.on('surprise:partner-left', (data) => {
    appendSystemMessage(`⚠️ ${data.message}`, DOM.surpriseMessagesStream);
    DOM.surpriseHeaderTitle.textContent = 'Match Disconnected';
    state.activeSurprisePartner = null;
    DOM.surpriseMingleNowBtn.classList.add('hidden');
    showToast('Your surprise match has disconnected.', 'info');
  });
}

// 7. HUB NAVIGATION & WORKPANE SWITCHER
function switchSection(sectionName) {
  state.activeSection = sectionName;

  // Update Nav Hub Button Classes
  [DOM.navBtnHome, DOM.navBtnChats, DOM.navBtnDiscover, DOM.navBtnOnline, DOM.navBtnMingled].forEach(btn => {
    if (btn) btn.classList.toggle('active', btn.dataset.section === sectionName);
  });

  // Update Mobile Bottom Nav Active Classes
  const mobileButtons = [DOM.mobileNavHome, DOM.mobileNavChats, DOM.mobileNavOnline];
  mobileButtons.forEach(btn => {
    if (btn) btn.classList.toggle('active', btn.dataset.section === sectionName);
  });

  // Hide All Panes
  DOM.sectionHomePane.classList.add('hidden');
  DOM.sectionChatsPane.classList.add('hidden');
  DOM.sectionDiscoverPane.classList.add('hidden');
  DOM.sectionOnlinePane.classList.add('hidden');
  DOM.sectionMingledPane.classList.add('hidden');
  DOM.sectionSurprisePane.classList.add('hidden');

  // Show Active Pane
  if (sectionName === 'home') {
    DOM.sectionHomePane.classList.remove('hidden');
    loadHomeData();
  } else if (sectionName === 'chats') {
    DOM.sectionChatsPane.classList.remove('hidden');
  } else if (sectionName === 'discover') {
    DOM.sectionDiscoverPane.classList.remove('hidden');
    DOM.discoverSearchInput.focus();
  } else if (sectionName === 'online') {
    DOM.sectionOnlinePane.classList.remove('hidden');
    loadOnlinePeople();
  } else if (sectionName === 'mingled') {
    DOM.sectionMingledPane.classList.remove('hidden');
    loadMingledNetwork();
  } else if (sectionName === 'surprise') {
    DOM.sectionSurprisePane.classList.remove('hidden');
    state.socket.emit('surprise:find');
  }

  // Close mobile sidebar on selection
  if (DOM.mainNavSidebar) DOM.mainNavSidebar.classList.add('-translate-x-full');
  if (DOM.mobileSidebarBackdrop) DOM.mobileSidebarBackdrop.classList.add('hidden');
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

// 8. SECTION LOADERS
async function loadHomeData() {
  if (state.socket && state.socket.connected) {
    state.socket.emit('user:home_data', (res) => {
      if (res?.success) {
        updateHomeUI(res);
      }
    });
  } else {
    try {
      const resp = await fetch(`/api/home-data?userId=${state.currentUser?.id || ''}`);
      const res = await resp.json();
      if (res?.success) {
        updateHomeUI(res);
      }
    } catch (e) {}
  }
}

function updateHomeUI(res) {
  if (DOM.homeStatOnlineMingles) DOM.homeStatOnlineMingles.textContent = res.onlineMinglesCount || 0;
  if (DOM.homeStatTotalMingles) DOM.homeStatTotalMingles.textContent = res.minglesCount || 0;
  if (DOM.homeStatTotalOnline) DOM.homeStatTotalOnline.textContent = res.totalOnlineCount || 0;
  if (DOM.navOnlineBadge) DOM.navOnlineBadge.textContent = res.totalOnlineCount || 0;
  if (DOM.navMingledBadge) DOM.navMingledBadge.textContent = res.minglesCount || 0;

  renderMobileStories(res.onlineMingles);
  renderHomeOnlineMingles(res.onlineMingles);
}

function renderMobileStories(mingles) {
  if (!DOM.mobileStoriesReel) return;
  DOM.mobileStoriesReel.innerHTML = '';

  // 1. Surprise quick bubble
  const surpriseBubble = document.createElement('div');
  surpriseBubble.className = 'story-bubble';
  surpriseBubble.onclick = () => switchSection('surprise');
  surpriseBubble.innerHTML = `
    <div class="story-ring-wrapper">
      <div class="story-ring-inner">
        <div class="w-14 h-14 rounded-full btn-coral flex items-center justify-center text-xl shadow-sm">
          🎲
        </div>
      </div>
    </div>
    <span class="text-[11px] font-bold text-gray-800 truncate max-w-[66px] mt-1 text-center">Surprise</span>
  `;
  DOM.mobileStoriesReel.appendChild(surpriseBubble);

  // Discover bubble
  const discoverBubble = document.createElement('div');
  discoverBubble.className = 'story-bubble';
  discoverBubble.onclick = () => switchSection('discover');
  discoverBubble.innerHTML = `
    <div class="story-ring-wrapper">
      <div class="story-ring-inner">
        <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg hover:bg-gray-200 transition">
          <i data-lucide="compass" class="w-6 h-6 text-gray-700"></i>
        </div>
      </div>
    </div>
    <span class="text-[11px] font-semibold text-gray-700 truncate max-w-[66px] mt-1 text-center">Discover</span>
  `;
  DOM.mobileStoriesReel.appendChild(discoverBubble);

  // Render ONLY real online mingled connections
  if (mingles && mingles.length > 0) {
    mingles.forEach(u => {
      const bubble = document.createElement('div');
      bubble.className = 'story-bubble';
      bubble.onclick = () => openChatWithUser(u.id);
      bubble.innerHTML = `
        <div class="story-ring-wrapper">
          <div class="story-ring-inner">
            <div class="relative">
              <img src="${u.avatar}" class="w-14 h-14 rounded-full object-cover">
              <span class="status-indicator ${u.isOnline ? 'status-online' : 'status-offline'} bottom-0 right-0"></span>
            </div>
          </div>
        </div>
        <span class="text-[11px] font-semibold text-gray-700 truncate max-w-[66px] mt-1 text-center">${escapeHtml((u.displayName || u.username).split(' ')[0])}</span>
      `;
      DOM.mobileStoriesReel.appendChild(bubble);
    });
  }
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function renderHomeOnlineMingles(mingles) {
  DOM.homeOnlineMinglesGrid.innerHTML = '';
  
  // If no real connections online, show clean inviting empty state
  if (!mingles || mingles.length === 0) {
    DOM.homeOnlineMinglesGrid.innerHTML = `
      <div class="col-span-full py-10 text-center bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <div class="w-12 h-12 rounded-full bg-rose-50 text-[#FF5A5F] flex items-center justify-center text-xl mx-auto mb-3">
          ✨
        </div>
        <h4 class="text-sm font-bold text-gray-900 mb-1">No connections online right now</h4>
        <p class="text-xs text-gray-500 max-w-sm mx-auto mb-4">Connect with real people on your network or start a Surprise Mingle to chat live!</p>
        <div class="flex items-center justify-center gap-2">
          <button onclick="switchSection('discover')" class="py-2 px-4 btn-coral text-white text-xs font-bold rounded-xl shadow transition">
            Explore Discover
          </button>
          <button onclick="switchSection('surprise')" class="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition">
            Surprise Mingle 🎲
          </button>
        </div>
      </div>
    `;
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    return;
  }

  // Render real connected users
  mingles.forEach(user => {
    const card = document.createElement('div');
    card.className = 'suggested-card p-5 flex flex-col justify-between space-y-4';
    const isOnline = user.isOnline ?? true;
    const displayName = user.displayName || user.username;
    const username = user.username;
    const bio = user.bio || 'Happy to connect and chat!';

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between">
          <div class="relative cursor-pointer" onclick="openProfileDrawer('${user.id}')">
            <img src="${user.avatar}" class="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 object-cover">
            <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'} bottom-0 right-0"></span>
          </div>
          <span class="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full">Connected</span>
        </div>
        <div class="mt-3">
          <h4 class="text-sm font-bold text-gray-900 truncate hover:text-[#FF5A5F] cursor-pointer" onclick="openProfileDrawer('${user.id}')">${escapeHtml(displayName)}</h4>
          <p class="text-xs font-medium text-gray-400 font-mono">@${username}</p>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">${escapeHtml(bio)}</p>
        </div>
      </div>

      <div class="pt-3 border-t border-gray-100 flex items-center gap-2">
        <button onclick="openChatWithUser('${user.id}')" class="flex-1 py-2 px-3 btn-coral text-xs font-bold rounded-xl flex items-center justify-center gap-1">
          <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
          <span>Message</span>
        </button>
        <button onclick="openProfileDrawer('${user.id}')" class="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition">
          View Profile
        </button>
      </div>
    `;
    DOM.homeOnlineMinglesGrid.appendChild(card);
  });
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

async function loadOnlinePeople() {
  if (state.socket && state.socket.connected) {
    state.socket.emit('user:online_list', (res) => {
      if (res?.success) {
        renderUserCardsGrid(res.users, DOM.onlinePeopleGrid, 'No one else is online right now. Open another browser or phone to test live chat!');
      }
    });
  } else {
    try {
      const resp = await fetch(`/api/users/online?userId=${state.currentUser?.id || ''}`);
      const res = await resp.json();
      if (res?.success) {
        renderUserCardsGrid(res.users, DOM.onlinePeopleGrid, 'No one else is online right now. Open another browser or phone to test live chat!');
      }
    } catch (e) {}
  }
}

async function loadMingledNetwork() {
  if (state.socket && state.socket.connected) {
    state.socket.emit('user:mingles_list', (res) => {
      if (res?.success) {
        DOM.mingledCountPill.textContent = res.mingles.length;
        renderUserCardsGrid(res.mingles, DOM.mingledNetworkGrid, 'You have not connected with anyone yet. Explore Discover to find connections!');
      }
    });
  } else {
    try {
      const resp = await fetch(`/api/home-data?userId=${state.currentUser?.id || ''}`);
      const res = await resp.json();
      if (res?.success && res?.onlineMingles) {
        DOM.mingledCountPill.textContent = res.minglesCount || res.onlineMingles.length;
        renderUserCardsGrid(res.onlineMingles, DOM.mingledNetworkGrid, 'You have not connected with anyone yet. Explore Discover to find connections!');
      }
    } catch (e) {}
  }
}

function renderUserCardsGrid(users, container, emptyText) {
  container.innerHTML = '';
  if (!users || users.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-xs text-gray-500 bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        ${escapeHtml(emptyText)}
      </div>
    `;
    return;
  }

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'suggested-card p-5 flex flex-col justify-between space-y-3.5';
    
    const statusDotClass = user.isOnline ? 'status-online' : 'status-offline';
    const lastSeenText = user.isOnline ? '● Online' : `○ Last seen ${formatLastSeen(user.lastSeen)}`;
    const statusTextColor = user.isOnline ? 'text-emerald-600' : 'text-gray-400';

    card.innerHTML = `
      <div class="flex items-start gap-3 min-w-0">
        <div class="relative shrink-0 cursor-pointer" onclick="openProfileDrawer('${user.id}')">
          <img src="${user.avatar}" class="w-12 h-12 rounded-2xl bg-gray-50 object-cover border border-gray-200">
          <span class="status-indicator ${statusDotClass} bottom-0 right-0"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-gray-900 truncate cursor-pointer hover:text-[#FF5A5F]" onclick="openProfileDrawer('${user.id}')">${escapeHtml(user.displayName)}</h4>
            <span class="text-[10px] font-mono ${statusTextColor}">${lastSeenText}</span>
          </div>
          <p class="text-[11px] text-gray-400 font-mono">@${user.username}</p>
          <p class="text-xs text-gray-600 truncate mt-1">${escapeHtml(user.bio || 'Happy to connect!')}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2.5 border-t border-gray-100">
        ${user.isMingled ? `
          <button onclick="handleMingleToggle('${user.id}', true)" class="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-600 text-xs font-bold border border-gray-200 transition">
            Disconnect
          </button>
        ` : `
          <button onclick="handleMingleToggle('${user.id}', false)" class="flex-1 py-2 rounded-xl btn-coral text-white text-xs font-bold shadow">
            Connect
          </button>
        `}
        <button onclick="openChatWithUser('${user.id}')" class="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold transition">
          Message
        </button>
      </div>
    `;
    container.appendChild(card);
  });
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

// 9. THREADS & ACTIVE CHAT LOGIC
function refreshThreads() {
  state.socket.emit('dm:threads', (res) => {
    if (res?.success) {
      state.threads = res.threads;
      renderSidebarThreads(res.threads);
      let totalUnread = 0;
      res.threads.forEach(t => totalUnread += t.unreadCount);
      state.unreadTotal = totalUnread;
      if (totalUnread > 0) {
        DOM.navChatsBadge.textContent = totalUnread;
        DOM.navChatsBadge.classList.remove('hidden');
        if (DOM.mobileNavChatsBadge) {
          DOM.mobileNavChatsBadge.textContent = totalUnread;
          DOM.mobileNavChatsBadge.classList.remove('hidden');
        }
      } else {
        DOM.navChatsBadge.classList.add('hidden');
        if (DOM.mobileNavChatsBadge) DOM.mobileNavChatsBadge.classList.add('hidden');
      }
    }
  });
}

function renderSidebarThreads(threads) {
  DOM.sidebarThreadsContainer.innerHTML = '';
  if (!threads || threads.length === 0) {
    DOM.sidebarThreadsContainer.innerHTML = `<p class="text-[11px] text-slate-500 px-2 py-2">No active chats yet.</p>`;
    return;
  }

  threads.forEach(t => {
    const user = t.partner;
    const isActive = state.activeSection === 'chats' && state.activeChatPartner?.id === user.id;
    const item = document.createElement('div');
    item.className = `p-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition select-none ${
      isActive ? 'bg-amber-500/15 border border-amber-500/30' : 'hover:bg-slate-900/70 text-slate-300'
    }`;

    item.innerHTML = `
      <div class="relative shrink-0">
        <img src="${user.avatar}" class="w-8 h-8 rounded-full bg-slate-800 object-cover border border-slate-700">
        <span class="status-indicator ${user.isOnline ? 'status-online' : 'status-offline'} bottom-0 right-0"></span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold text-white truncate">${escapeHtml(user.displayName)}</p>
          <span class="text-[9px] text-slate-500">${formatTime(t.lastMessage.timestamp)}</span>
        </div>
        <div class="flex items-center justify-between">
          <p class="text-[11px] text-slate-400 truncate max-w-[130px]">${escapeHtml(t.lastMessage.content || 'Attachment')}</p>
          ${t.unreadCount > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">${t.unreadCount}</span>` : ''}
        </div>
      </div>
    `;

    item.onclick = () => openChatWithUser(user.id);
    DOM.sidebarThreadsContainer.appendChild(item);
  });
}

function openChatWithUser(userId) {
  state.socket.emit('dm:open', userId, (res) => {
    if (res?.success) {
      state.activeChatPartner = res.recipient;
      switchSection('chats');
      updateChatHeaderPresence(res.recipient);

      DOM.chatMessagesStream.innerHTML = '';
      if (res.history && res.history.length > 0) {
        res.history.forEach(m => appendChatMessage(m, DOM.chatMessagesStream, false));
        scrollToBottom(DOM.chatMessagesStream);
      } else {
        renderEmptyChat(res.recipient);
      }
      refreshThreads();
    } else {
      showToast(res?.error || 'Could not open chat', 'error');
    }
  });
}

function updateChatHeaderPresence(user) {
  DOM.chatPartnerAvatar.src = user.avatar;
  DOM.chatPartnerDisplayName.textContent = user.displayName;
  DOM.chatPartnerUsername.textContent = `@${user.username}`;
  
  DOM.chatPartnerStatusDot.className = `status-indicator ${user.isOnline ? 'status-online' : 'status-offline'} bottom-0 right-0`;
  DOM.chatPartnerBio.textContent = user.isOnline ? '● Online • Available to chat' : `○ Last seen ${formatLastSeen(user.lastSeen)}`;

  if (user.isMingled) {
    DOM.chatMingleStateBadge.textContent = '✓ Mingled';
    DOM.chatMingleStateBadge.className = 'text-[10px] px-2 py-0.2 rounded-full font-semibold border bg-amber-950/60 text-amber-400 border-amber-500/30';
    DOM.chatToggleMingleBtn.textContent = 'Unmingle';
    DOM.chatToggleMingleBtn.className = 'px-3 py-1 rounded-xl text-xs font-bold transition border border-slate-700 hover:border-rose-500 hover:text-rose-400 text-slate-300';
  } else {
    DOM.chatMingleStateBadge.textContent = 'Not Mingled';
    DOM.chatMingleStateBadge.className = 'text-[10px] px-2 py-0.2 rounded-full font-semibold border bg-slate-900 text-slate-400 border-slate-800';
    DOM.chatToggleMingleBtn.textContent = '+ Mingle';
    DOM.chatToggleMingleBtn.className = 'px-3 py-1 rounded-xl text-xs font-bold transition bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow';
  }
}

function renderEmptyChat(user) {
  DOM.chatMessagesStream.innerHTML = `
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center h-full min-h-[250px]">
      <img src="${user.avatar}" class="w-16 h-16 rounded-3xl bg-slate-800 border-2 border-amber-500/40 object-cover shadow-xl mb-3">
      <h3 class="text-sm font-bold text-white">${escapeHtml(user.displayName)} (@${user.username})</h3>
      <p class="text-xs text-slate-400 mt-1 max-w-xs">Start the conversation! Send a message to chat in real-time.</p>
    </div>
  `;
}

// 10. MINGLE / UNMINGLE ACTIONS
function handleMingleToggle(targetUserId, isCurrentlyMingled) {
  if (isCurrentlyMingled) {
    state.socket.emit('user:unmingle', targetUserId, (res) => {
      if (res?.success) {
        showToast('Unmingled successfully', 'info');
        loadHomeData();
        if (state.activeSection === 'mingled') loadMingledNetwork();
        if (state.activeSection === 'online') loadOnlinePeople();
        if (state.activeChatPartner?.id === targetUserId) {
          state.activeChatPartner.isMingled = false;
          updateChatHeaderPresence(state.activeChatPartner);
        }
      }
    });
  } else {
    state.socket.emit('user:mingle', targetUserId, (res) => {
      if (res?.success) {
        sounds.playMingleConnect();
        showToast('🎉 Mingled successfully!', 'success');
        loadHomeData();
        if (state.activeSection === 'mingled') loadMingledNetwork();
        if (state.activeSection === 'online') loadOnlinePeople();
        if (state.activeChatPartner?.id === targetUserId) {
          state.activeChatPartner.isMingled = true;
          updateChatHeaderPresence(state.activeChatPartner);
        }
      }
    });
  }
}

// 11. SEARCH & DISCOVERY
function executeSearch(query) {
  state.socket.emit('user:search', query, (res) => {
    if (res?.success) {
      renderUserCardsGrid(res.results, DOM.discoverResultsContainer, `No users found matching "${query}"`);
    }
  });
}

function executeTopSearch(query) {
  if (!query || query.trim().length === 0) {
    DOM.topSearchDropdown.classList.add('hidden');
    return;
  }

  state.socket.emit('user:search', query, (res) => {
    if (res?.success) {
      renderTopSearchDropdown(res.results);
    }
  });
}

function renderTopSearchDropdown(results) {
  DOM.topSearchDropdown.innerHTML = '';
  if (!results || results.length === 0) {
    DOM.topSearchDropdown.innerHTML = `<p class="p-3 text-xs text-slate-500 text-center">No people found</p>`;
    DOM.topSearchDropdown.classList.remove('hidden');
    return;
  }

  results.forEach(user => {
    const item = document.createElement('div');
    item.className = 'p-2.5 rounded-xl hover:bg-slate-800 flex items-center justify-between cursor-pointer transition select-none';
    item.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0" onclick="openProfileDrawer('${user.id}')">
        <img src="${user.avatar}" class="w-8 h-8 rounded-full bg-slate-800 object-cover border border-slate-700">
        <div class="truncate">
          <p class="text-xs font-bold text-white truncate">${escapeHtml(user.displayName)}</p>
          <p class="text-[10px] text-amber-400/80 font-mono truncate">@${user.username}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button onclick="handleMingleToggle('${user.id}', ${user.isMingled}); event.stopPropagation();" class="px-2.5 py-1 text-[10px] font-bold rounded-lg ${user.isMingled ? 'bg-slate-700 text-slate-300' : 'bg-amber-500 text-slate-950'}">
          ${user.isMingled ? 'Mingled' : 'Mingle'}
        </button>
        <button onclick="openChatWithUser('${user.id}'); event.stopPropagation();" class="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-700 text-white">
          Chat
        </button>
      </div>
    `;
    DOM.topSearchDropdown.appendChild(item);
  });
  DOM.topSearchDropdown.classList.remove('hidden');
}

// 12. MESSAGE RENDERING
function appendChatMessage(msg, container, autoScroll = true) {
  const isMe = msg.senderId === state.currentUser?.id;
  const timeStr = formatTime(msg.timestamp);

  const wrapper = document.createElement('div');
  wrapper.className = `flex gap-2.5 message-enter group relative ${isMe ? 'justify-end' : 'justify-start'}`;
  wrapper.id = `msg_${msg.id}`;

  let attachmentHtml = '';
  if (msg.attachment && msg.attachment.data) {
    if (msg.attachment.type?.startsWith('image/')) {
      attachmentHtml = `
        <div class="mt-2 overflow-hidden rounded-xl cursor-pointer max-w-xs shadow-md border border-slate-700/60" onclick="openLightbox('${msg.attachment.data}')">
          <img src="${msg.attachment.data}" class="w-full object-cover max-h-56 rounded-xl hover:scale-105 transition duration-200">
        </div>
      `;
    } else {
      attachmentHtml = `
        <a href="${msg.attachment.data}" download="${msg.attachment.name || 'document'}" class="mt-2 flex items-center gap-2.5 p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl hover:border-amber-500/50 transition">
          <i data-lucide="file-text" class="w-5 h-5 text-amber-400 shrink-0"></i>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-200 truncate">${escapeHtml(msg.attachment.name || 'document')}</p>
            <p class="text-[10px] text-slate-400">${formatFileSize(msg.attachment.size)} • Click to download</p>
          </div>
        </a>
      `;
    }
  }

  // Reactions
  let reactionsHtml = `<div class="flex flex-wrap gap-1 mt-1 reactions-wrapper" id="reactions_${msg.id}">`;
  if (msg.reactions) {
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (users.length > 0) {
        const isReactedByMe = users.includes(state.currentUser?.username);
        reactionsHtml += `
          <button class="reaction-pill ${isReactedByMe ? 'active' : ''}" onclick="toggleReaction('${msg.id}', '${emoji}')">
            <span>${emoji}</span>
            <span>${users.length}</span>
          </button>
        `;
      }
    }
  }
  reactionsHtml += '</div>';

  if (isMe) {
    wrapper.innerHTML = `
      <div class="flex flex-col items-end max-w-md lg:max-w-xl">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="msg-read-status text-[10px] ${msg.read ? 'text-[#FF5A5F] font-semibold' : 'text-gray-400'}">
            ${msg.read ? '✓✓ Read' : '✓ Sent'}
          </span>
          <span class="text-[10px] text-gray-400">${timeStr}</span>
        </div>
        <div class="py-2.5 px-4 rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#FF5A5F] to-[#FF3366] text-white font-medium shadow-md shadow-coral-500/20 text-xs leading-relaxed break-words">
          ${escapeHtml(msg.content)}
          ${attachmentHtml}
        </div>
        ${reactionsHtml}
      </div>
      <img src="${msg.senderAvatar || state.currentUser.avatar}" class="w-8 h-8 rounded-full bg-gray-100 object-cover shrink-0 mt-1 border border-gray-200">
    `;
  } else {
    wrapper.innerHTML = `
      <img src="${msg.senderAvatar}" class="w-8 h-8 rounded-full bg-gray-100 object-cover shrink-0 mt-1 border border-gray-200">
      <div class="flex flex-col items-start max-w-md lg:max-w-xl">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-xs font-bold text-gray-800">${escapeHtml(msg.senderDisplayName || 'User')}</span>
          <span class="text-[10px] text-gray-400">${timeStr}</span>
        </div>
        <div class="py-2.5 px-4 rounded-2xl rounded-tl-sm bg-white text-gray-900 border border-gray-200 shadow-sm text-xs leading-relaxed break-words group relative">
          ${escapeHtml(msg.content)}
          ${attachmentHtml}
          <!-- Quick Reactions on Hover -->
          <div class="absolute -top-3 right-2 hidden group-hover:flex items-center bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-md gap-1 z-10 select-none">
            <span class="cursor-pointer text-xs hover:scale-125 transition" onclick="toggleReaction('${msg.id}', '❤️')">❤️</span>
            <span class="cursor-pointer text-xs hover:scale-125 transition" onclick="toggleReaction('${msg.id}', '👍')">👍</span>
            <span class="cursor-pointer text-xs hover:scale-125 transition" onclick="toggleReaction('${msg.id}', '🔥')">🔥</span>
          </div>
        </div>
        ${reactionsHtml}
      </div>
    `;
  }

  container.appendChild(wrapper);
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  if (autoScroll) scrollToBottom(container);
}

function appendSystemMessage(text, container) {
  const div = document.createElement('div');
  div.className = 'flex justify-center my-2 message-enter';
  div.innerHTML = `
    <div class="px-3.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1.5 shadow-sm">
      <span>${escapeHtml(text)}</span>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom(container);
}

function toggleReaction(messageId, emoji) {
  state.socket.emit('message:reaction', { messageId, emoji });
}

// 13. RIGHT PROFILE DRAWER
function openProfileDrawer(userId) {
  state.socket.emit('dm:open', userId, (res) => {
    if (res?.success) {
      const user = res.recipient;
      DOM.drawerAvatar.src = user.avatar;
      DOM.drawerDisplayName.textContent = user.displayName;
      DOM.drawerUsername.textContent = `@${user.username}`;
      DOM.drawerBio.textContent = user.bio || 'Happy to connect & chat!';
      DOM.drawerMinglesCount.textContent = user.mingleCount || 0;
      DOM.drawerMingleStatusText.textContent = user.mingleStatus ? user.mingleStatus.toUpperCase() : 'AVAILABLE';
      DOM.drawerLastSeen.textContent = user.isOnline ? '● Online' : `○ Last seen ${formatLastSeen(user.lastSeen)}`;
      DOM.drawerStatusDot.className = `status-indicator ${user.isOnline ? 'status-online' : 'status-offline'} bottom-0 right-0`;

      if (user.isMingled) {
        DOM.drawerMingleBtn.textContent = 'Disconnect';
        DOM.drawerMingleBtn.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-600 border border-gray-200';
      } else {
        DOM.drawerMingleBtn.textContent = '+ Connect';
        DOM.drawerMingleBtn.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition btn-coral text-white shadow';
      }

      DOM.drawerMingleBtn.onclick = () => handleMingleToggle(user.id, user.isMingled);
      DOM.drawerMessageBtn.onclick = () => openChatWithUser(user.id);

      if (DOM.rightCommunityWidgets) DOM.rightCommunityWidgets.classList.add('hidden');
      DOM.rightProfileDrawer.classList.remove('hidden');
      DOM.rightProfileDrawer.classList.add('flex');
    }
  });
}

// 14. EVENT LISTENERS
function setupEventListeners() {
  // Check Username Debounce
  DOM.regUsernameInput.addEventListener('input', (e) => {
    clearTimeout(state.usernameCheckTimer);
    const val = e.target.value.trim().replace(/^@+/, '').trim();
    if (!val) {
      DOM.usernameFeedback.textContent = '';
      DOM.usernameCheckIcon.classList.add('hidden');
      return;
    }
    state.usernameCheckTimer = setTimeout(async () => {
      try {
        const resp = await fetch('/api/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: val })
        });
        const res = await resp.json();
        if (res.available) {
          DOM.usernameFeedback.textContent = 'Username available ✓';
          DOM.usernameFeedback.className = 'text-[11px] mt-1 font-semibold text-emerald-400';
          DOM.usernameCheckIcon.classList.remove('hidden');
        } else {
          DOM.usernameFeedback.textContent = res.error;
          DOM.usernameFeedback.className = 'text-[11px] mt-1 font-semibold text-rose-400';
          DOM.usernameCheckIcon.classList.add('hidden');
        }
      } catch (e) {}
    }, 200);
  });

  // Profile Photo Upload Handlers
  if (DOM.regAvatarPreviewContainer) {
    DOM.regAvatarPreviewContainer.addEventListener('click', () => DOM.regPhotoUploadInput.click());
  }
  if (DOM.regUploadPhotoBtn) {
    DOM.regUploadPhotoBtn.addEventListener('click', () => DOM.regPhotoUploadInput.click());
  }

  if (DOM.regPhotoUploadInput) {
    DOM.regPhotoUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Profile photo must be less than 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.customAvatarDataUrl = ev.target.result;
        DOM.regPhotoPreview.src = ev.target.result;
        showToast('Profile photo selected! 📷', 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  if (DOM.toggleAvatarsListBtn) {
    DOM.toggleAvatarsListBtn.addEventListener('click', () => {
      DOM.collapsibleAvatarSection.classList.toggle('hidden');
    });
  }

  // Password Visibility Toggles
  if (DOM.toggleRegPasswordBtn) {
    DOM.toggleRegPasswordBtn.addEventListener('click', () => {
      const isPwd = DOM.regPasswordInput.type === 'password';
      DOM.regPasswordInput.type = isPwd ? 'text' : 'password';
      DOM.regPasswordEyeIcon.setAttribute('data-lucide', isPwd ? 'eye-off' : 'eye');
      if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    });
  }

  if (DOM.toggleLoginPasswordBtn) {
    DOM.toggleLoginPasswordBtn.addEventListener('click', () => {
      const isPwd = DOM.loginPasswordInput.type === 'password';
      DOM.loginPasswordInput.type = isPwd ? 'text' : 'password';
      DOM.loginPasswordEyeIcon.setAttribute('data-lucide', isPwd ? 'eye-off' : 'eye');
      if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    });
  }

  // Register Identity Form Submit (Direct HTTP REST with instant response & offline fallback)
  DOM.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = DOM.regUsernameInput.value.trim().replace(/^@+/, '').trim();
    const displayName = DOM.regDisplayNameInput.value.trim() || username;
    const password = DOM.regPasswordInput.value;
    const bio = DOM.regBioInput.value.trim();
    const avatar = state.customAvatarDataUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.selectedAvatarSeed}`;

    if (DOM.regErrorMsg) DOM.regErrorMsg.classList.add('hidden');

    if (!username || username.length < 3) {
      if (DOM.regErrorMsg) {
        DOM.regErrorMsg.textContent = 'Please enter a username (at least 3 characters)';
        DOM.regErrorMsg.classList.remove('hidden');
      }
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    if (!password || password.length < 4) {
      if (DOM.regErrorMsg) {
        DOM.regErrorMsg.textContent = 'Password must be at least 4 characters';
        DOM.regErrorMsg.classList.remove('hidden');
      }
      showToast('Password must be at least 4 characters', 'error');
      return;
    }

    // Set Button Loading State
    if (DOM.createIdBtnText) DOM.createIdBtnText.textContent = 'Entering Mingle...';
    if (DOM.createIdentityBtn) DOM.createIdentityBtn.disabled = true;

    // Guaranteed local profile creation fallback
    const localProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      username,
      displayName,
      avatar,
      bio: bio || 'Ready to chat & mingle!',
      status: 'online',
      mingleStatus: 'available',
      isOnline: true,
      sessionToken: 'tok_' + Math.random().toString(36).substring(2, 11),
      lastSeen: Date.now(),
      createdAt: Date.now()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password, avatar, bio }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const res = await response.json();

      if (DOM.createIdBtnText) DOM.createIdBtnText.textContent = 'Create Profile';
      if (DOM.createIdentityBtn) DOM.createIdentityBtn.disabled = false;

      if (res?.success && res?.user) {
        setCurrentUser(res.user);
        if (state.socket && state.socket.connected) {
          state.socket.emit('user:restore_session', { userId: res.user.id, sessionToken: res.user.sessionToken });
        }
        showToast(`🎉 Welcome to Mingle, ${res.user.displayName}!`, 'success');
        return;
      } else if (res?.error && res.error.toLowerCase().includes('already taken')) {
        // Try auto-authenticating with the entered password
        try {
          const loginResp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const loginRes = await loginResp.json();
          if (loginRes?.success && loginRes?.user) {
            setCurrentUser(loginRes.user);
            if (state.socket && state.socket.connected) {
              state.socket.emit('user:restore_session', { userId: loginRes.user.id, sessionToken: loginRes.user.sessionToken });
            }
            showToast(`Welcome back, ${loginRes.user.displayName}!`, 'success');
            return;
          }
        } catch (e) {}

        if (DOM.regErrorMsg) {
          DOM.regErrorMsg.innerHTML = `<span>❌ ${escapeHtml(res.error)}</span><div class="mt-1.5 text-xs text-[#FF5A5F] font-bold cursor-pointer underline" onclick="showAuthModal('login')">Already have this account? Sign In →</div>`;
          DOM.regErrorMsg.classList.remove('hidden');
        }
        DOM.usernameFeedback.textContent = res.error;
        DOM.usernameFeedback.className = 'text-[10px] mt-0.5 font-semibold text-rose-400';
        showToast(res.error, 'error');
        return;
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }

    if (DOM.createIdBtnText) DOM.createIdBtnText.textContent = 'Create Profile';
    if (DOM.createIdentityBtn) DOM.createIdentityBtn.disabled = false;

    // Set local profile and let user in immediately!
    setCurrentUser(localProfile);
    showToast(`🎉 Welcome to Mingle, ${localProfile.displayName}!`, 'success');
  });

  // Login Form Submit (Direct HTTP REST with instant response & offline fallback)
  DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = DOM.loginUsernameInput.value.trim().replace(/^@+/, '').trim();
    const password = DOM.loginPasswordInput.value;

    if (DOM.loginErrorMsg) DOM.loginErrorMsg.classList.add('hidden');

    if (!username) {
      if (DOM.loginErrorMsg) {
        DOM.loginErrorMsg.textContent = 'Please enter your username';
        DOM.loginErrorMsg.classList.remove('hidden');
      }
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const res = await response.json();

      if (res?.success && res?.user) {
        setCurrentUser(res.user);
        if (state.socket && state.socket.connected) {
          state.socket.emit('user:restore_session', { userId: res.user.id, sessionToken: res.user.sessionToken });
        }
        hideAuthModal();
        showToast(`Welcome back, ${res.user.displayName}!`, 'success');
        return;
      } else if (res?.error && !res.error.toLowerCase().includes('failed to fetch')) {
        if (DOM.loginErrorMsg) {
          DOM.loginErrorMsg.textContent = res.error;
          DOM.loginErrorMsg.classList.remove('hidden');
        }
        showToast(res.error, 'error');
        return;
      }
    } catch (err) {
      // Backend not reachable — fallback
    }

    // Check if saved user matches
    const savedUserJson = localStorage.getItem('mingle_user');
    let localUser = null;
    if (savedUserJson) {
      try {
        const u = JSON.parse(savedUserJson);
        if (u && u.username && u.username.toLowerCase() === username.toLowerCase()) {
          localUser = u;
        }
      } catch(e) {}
    }

    if (!localUser) {
      localUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        username,
        displayName: username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        bio: 'Ready to chat & mingle!',
        status: 'online',
        mingleStatus: 'available',
        isOnline: true,
        sessionToken: 'tok_' + Date.now(),
        lastSeen: Date.now(),
        createdAt: Date.now()
      };
    }

    setCurrentUser(localUser);
    hideAuthModal();
    showToast(`Welcome back, ${localUser.displayName}!`, 'success');
  });

  DOM.authTabRegister.addEventListener('click', () => showAuthModal('register'));
  DOM.authTabLogin.addEventListener('click', () => showAuthModal('login'));

  DOM.randomizeAvatarsBtn.addEventListener('click', randomizeAvatars);

  // Top Search Input
  DOM.topSearchInput.addEventListener('input', (e) => {
    clearTimeout(state.topSearchTimer);
    const q = e.target.value.trim();
    state.topSearchTimer = setTimeout(() => executeTopSearch(q), 200);
  });

  document.addEventListener('click', (e) => {
    if (!DOM.topSearchDropdown.contains(e.target) && e.target !== DOM.topSearchInput) {
      DOM.topSearchDropdown.classList.add('hidden');
    }
  });

  // Nav Hub Buttons
  DOM.navBtnHome.addEventListener('click', () => switchSection('home'));
  DOM.navBtnChats.addEventListener('click', () => switchSection('chats'));
  DOM.navBtnDiscover.addEventListener('click', () => switchSection('discover'));
  DOM.navBtnOnline.addEventListener('click', () => switchSection('online'));
  DOM.navBtnMingled.addEventListener('click', () => switchSection('mingled'));
  DOM.quickSurpriseBanner.addEventListener('click', () => switchSection('surprise'));

  DOM.brandLogoHome.addEventListener('click', () => switchSection('home'));
  DOM.homeViewAllMingledBtn.addEventListener('click', () => switchSection('mingled'));
  DOM.homeDiscoverBtn.addEventListener('click', () => switchSection('discover'));
  DOM.homeSurpriseBtn.addEventListener('click', () => switchSection('surprise'));

  DOM.discoverSearchInput.addEventListener('input', (e) => {
    executeSearch(e.target.value);
  });

  DOM.refreshOnlineBtn.addEventListener('click', loadOnlinePeople);

  // Active Chat Message Submit
  DOM.activeChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeChatPartner || !state.currentUser) return;
    const text = DOM.chatTextInput.value.trim();
    const attachment = state.attachedFile;

    if (!text && !attachment) return;

    if (state.socket && state.socket.connected) {
      state.socket.emit('dm:message', {
        recipientId: state.activeChatPartner.id,
        content: text,
        attachment
      });
    }

    // Also send via REST API for serverless & cross-network delivery
    try {
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: state.currentUser.id,
          receiverId: state.activeChatPartner.id,
          content: text,
          attachment
        })
      });
    } catch (err) {}

    // Immediate local message display
    const localMsg = {
      id: 'msg_' + Date.now(),
      type: attachment ? (attachment.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      senderId: state.currentUser.id,
      senderUsername: state.currentUser.username,
      senderDisplayName: state.currentUser.displayName,
      senderAvatar: state.currentUser.avatar,
      receiverId: state.activeChatPartner.id,
      content: text,
      attachment,
      reactions: {},
      read: true,
      timestamp: Date.now()
    };
    appendChatMessage(localMsg, DOM.chatMessagesStream);

    sounds.playSend();
    DOM.chatTextInput.value = '';
    clearAttachment();
    DOM.chatEmojiDrawer.classList.add('hidden');
    if (state.socket && state.socket.connected) {
      state.socket.emit('dm:typing', { recipientId: state.activeChatPartner.id, isTyping: false });
    }
  });

  // Surprise Chat Submit
  DOM.surpriseChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.surpriseTextInput.value.trim();
    if (!text) return;

    state.socket.emit('surprise:message', { content: text });
    sounds.playSend();
    DOM.surpriseTextInput.value = '';
    state.socket.emit('surprise:typing', { isTyping: false });
  });

  DOM.surpriseMingleNowBtn.addEventListener('click', () => {
    state.socket.emit('surprise:mingle_now', (res) => {
      if (res?.success) {
        sounds.playMingleConnect();
        showToast('🎉 You mingled with your surprise partner!', 'success');
        DOM.surpriseMingleNowBtn.textContent = '✓ MINGLED!';
        DOM.surpriseMingleNowBtn.classList.add('bg-emerald-600');
        loadHomeData();
      }
    });
  });

  DOM.surpriseNextBtn.addEventListener('click', () => {
    state.socket.emit('surprise:next');
  });

  DOM.surpriseExitBtn.addEventListener('click', () => {
    state.socket.emit('surprise:leave');
    switchSection('home');
  });

  DOM.cancelSurpriseSearchBtn.addEventListener('click', () => {
    state.socket.emit('surprise:leave');
    switchSection('home');
  });

  // Chat typing
  DOM.chatTextInput.addEventListener('input', () => {
    if (!state.activeChatPartner) return;
    state.socket.emit('dm:typing', { recipientId: state.activeChatPartner.id, isTyping: true });
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      state.socket.emit('dm:typing', { recipientId: state.activeChatPartner.id, isTyping: false });
    }, 1500);
  });

  // Mingle toggle in chat header
  DOM.chatToggleMingleBtn.addEventListener('click', () => {
    if (!state.activeChatPartner) return;
    handleMingleToggle(state.activeChatPartner.id, state.activeChatPartner.isMingled);
  });

  DOM.chatProfileToggleBtn.addEventListener('click', () => {
    if (state.activeChatPartner) openProfileDrawer(state.activeChatPartner.id);
  });

  DOM.clearChatViewBtn.addEventListener('click', () => {
    DOM.chatMessagesStream.innerHTML = '';
  });

  // Emoji Drawer
  DOM.chatEmojiToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.chatEmojiDrawer.classList.toggle('hidden');
  });

  DOM.chatEmojiGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-btn')) {
      DOM.chatTextInput.value += e.target.textContent;
      DOM.chatTextInput.focus();
    }
  });

  // File Upload
  DOM.chatAttachBtn.addEventListener('click', () => DOM.chatFileInput.click());

  DOM.chatFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File exceeds 5MB limit', 'error');
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

      DOM.attachmentNameText.textContent = file.name;
      DOM.attachmentSizeText.textContent = formatFileSize(file.size);

      if (file.type.startsWith('image/')) {
        DOM.attachmentImagePreview.src = ev.target.result;
        DOM.attachmentImagePreview.classList.remove('hidden');
        DOM.attachmentDocIcon.classList.add('hidden');
      } else {
        DOM.attachmentImagePreview.classList.add('hidden');
        DOM.attachmentDocIcon.classList.remove('hidden');
      }

      DOM.chatAttachmentPreviewBar.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  DOM.cancelChatAttachmentBtn.addEventListener('click', clearAttachment);

  // Status Picker in Header
  DOM.userMingleStatusSelect.addEventListener('change', (e) => {
    const mingleStatus = e.target.value;
    state.socket.emit('user:update_status', { mingleStatus });
  });

  // Profile Settings Modal
  DOM.headerUserChip.addEventListener('click', openSettingsModal);
  DOM.footerProfileBtn.addEventListener('click', openSettingsModal);
  DOM.profileSettingsBtn.addEventListener('click', openSettingsModal);
  DOM.closeSettingsModalBtn.addEventListener('click', () => DOM.profileSettingsModal.classList.add('hidden'));

  // Settings Profile Photo Handlers
  if (DOM.settingsPhotoContainer) {
    DOM.settingsPhotoContainer.addEventListener('click', () => DOM.settingsPhotoUploadInput.click());
  }
  if (DOM.settingsUploadPhotoBtn) {
    DOM.settingsUploadPhotoBtn.addEventListener('click', () => DOM.settingsPhotoUploadInput.click());
  }
  if (DOM.settingsPhotoUploadInput) {
    DOM.settingsPhotoUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo must be less than 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.settingsAvatarDataUrl = ev.target.result;
        DOM.settingsPhotoPreview.src = ev.target.result;
        showToast('New photo selected! Click Save Changes.', 'info');
      };
      reader.readAsDataURL(file);
    });
  }

  DOM.updateProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const displayName = DOM.settingsDisplayNameInput.value.trim();
    const bio = DOM.settingsBioInput.value.trim();
    const avatar = state.settingsAvatarDataUrl || state.currentUser.avatar;
    const privacySettings = {
      showOnlineStatus: DOM.settingShowOnlineStatus.checked,
      allowSurpriseMingle: DOM.settingAllowSurpriseMingle.checked,
      allowMessagesFromNonMingles: DOM.settingAllowNonMingleMessages.checked
    };

    state.socket.emit('user:update_profile', { displayName, bio, avatar, privacySettings }, (res) => {
      if (res?.success) {
        setCurrentUser(res.user);
        state.settingsAvatarDataUrl = null;
        DOM.profileSettingsModal.classList.add('hidden');
        showToast('Profile and settings updated!', 'success');
      }
    });
  });

  DOM.switchAccountBtn.addEventListener('click', () => {
    localStorage.removeItem('mingle_user');
    state.currentUser = null;
    DOM.profileSettingsModal.classList.add('hidden');
    DOM.regUsernameInput.value = '';
    DOM.regDisplayNameInput.value = '';
    DOM.regPasswordInput.value = '';
    DOM.regBioInput.value = '';
    DOM.loginUsernameInput.value = '';
    DOM.loginPasswordInput.value = '';
    showAuthModal('login');
  });

  DOM.closeRightDrawerBtn.addEventListener('click', () => {
    DOM.rightProfileDrawer.classList.add('hidden');
    DOM.rightProfileDrawer.classList.remove('flex');
    if (DOM.rightCommunityWidgets) DOM.rightCommunityWidgets.classList.remove('hidden');
  });

  // Mobile Menu Toggle & Backdrop
  DOM.mobileMenuToggle.addEventListener('click', () => {
    const isClosed = DOM.mainNavSidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      DOM.mainNavSidebar.classList.remove('-translate-x-full');
      if (DOM.mobileSidebarBackdrop) DOM.mobileSidebarBackdrop.classList.remove('hidden');
    } else {
      DOM.mainNavSidebar.classList.add('-translate-x-full');
      if (DOM.mobileSidebarBackdrop) DOM.mobileSidebarBackdrop.classList.add('hidden');
    }
  });

  if (DOM.mobileSidebarBackdrop) {
    DOM.mobileSidebarBackdrop.addEventListener('click', () => {
      DOM.mainNavSidebar.classList.add('-translate-x-full');
      DOM.mobileSidebarBackdrop.classList.add('hidden');
    });
  }

  // Mobile App Bottom Navigation Tabs
  if (DOM.mobileNavHome) DOM.mobileNavHome.addEventListener('click', () => switchSection('home'));
  if (DOM.mobileNavDiscover) DOM.mobileNavDiscover.addEventListener('click', () => switchSection('discover'));
  if (DOM.mobileNavSurprise) DOM.mobileNavSurprise.addEventListener('click', () => switchSection('surprise'));
  if (DOM.mobileNavChats) DOM.mobileNavChats.addEventListener('click', () => switchSection('chats'));
  if (DOM.mobileNavProfile) DOM.mobileNavProfile.addEventListener('click', openSettingsModal);

  // Mobile Back Button in Chat View
  if (DOM.chatMobileBackBtn) {
    DOM.chatMobileBackBtn.addEventListener('click', () => {
      switchSection('home');
    });
  }

  // Sound Toggle
  DOM.soundToggleBtn.addEventListener('click', () => {
    sounds.enabled = !sounds.enabled;
    localStorage.setItem('mingle_sound', sounds.enabled);
    setupSoundUI();
  });

  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('mingle_theme', isDark ? 'dark' : 'light');
    setupTheme();
  });

  DOM.imageLightboxModal.addEventListener('click', () => {
    DOM.imageLightboxModal.classList.add('hidden');
    DOM.imageLightboxModal.classList.remove('flex');
  });
}

function openSettingsModal() {
  if (!state.currentUser) return;
  DOM.settingsModalUsername.textContent = `@${state.currentUser.username}`;
  DOM.settingsDisplayNameInput.value = state.currentUser.displayName;
  DOM.settingsBioInput.value = state.currentUser.bio || '';
  DOM.settingsPhotoPreview.src = state.currentUser.avatar;
  state.settingsAvatarDataUrl = null;
  DOM.settingShowOnlineStatus.checked = state.currentUser.privacySettings?.showOnlineStatus !== false;
  DOM.settingAllowSurpriseMingle.checked = state.currentUser.privacySettings?.allowSurpriseMingle !== false;
  DOM.settingAllowNonMingleMessages.checked = state.currentUser.privacySettings?.allowMessagesFromNonMingles !== false;

  DOM.profileSettingsModal.classList.remove('hidden');
  DOM.profileSettingsModal.classList.add('flex');
}

function clearAttachment() {
  state.attachedFile = null;
  DOM.chatFileInput.value = '';
  DOM.chatAttachmentPreviewBar.classList.add('hidden');
}

function openLightbox(url) {
  DOM.lightboxImageElement.src = url;
  DOM.imageLightboxModal.classList.remove('hidden');
  DOM.imageLightboxModal.classList.add('flex');
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(ts) {
  if (!ts) return 'recently';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
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

function setupSoundUI() {
  if (DOM.soundIcon) {
    DOM.soundIcon.setAttribute('data-lucide', sounds.enabled ? 'volume-2' : 'volume-x');
  }
  if (DOM.soundToggleBtn) {
    DOM.soundToggleBtn.classList.toggle('text-rose-400', !sounds.enabled);
  }
  if (window.lucide) if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function setupTheme() {
  const saved = localStorage.getItem('mingle_theme') || 'light';
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    if (DOM.themeIcon) DOM.themeIcon.setAttribute('data-lucide', 'sun');
  } else {
    document.documentElement.classList.remove('dark');
    if (DOM.themeIcon) DOM.themeIcon.setAttribute('data-lucide', 'moon');
  }
  if (window.lucide) if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

// Robust bootstrap
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
