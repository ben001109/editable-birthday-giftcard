import { firebaseConfig } from './config.js';

// 引入 Firebase SDK (CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  Timestamp,
  query,
  where,
  getDocs,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ==========================================================================
// 全域狀態管理與設定 (Global State & Settings)
// ==========================================================================
let db = null;
let auth = null;
let offlineMode = false;
let currentCardData = null;
let audioContext = null;
let bgMusicElement = null;
let isMusicPlaying = false;
let spawnedBalloons = [];
let micStream = null;
let micInterval = null;

// 背景音樂預設音源清單 (免費開源音源)
const MUSIC_SOURCES = {
  'music-piano-hbd': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'music-box-hbd': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'music-party-hbd': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
};

// ==========================================================================
// 初始化 Firebase / 離線模式判定 (Initialize Firebase)
// ==========================================================================
function initFirebase() {
  const isPlaceholderKey = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_API_KEY');
  
  if (isPlaceholderKey) {
    console.warn('⚠️ Firebase API 金鑰尚未配置。系統已自動啟動「離線 URL 壓縮分享模式」。');
    offlineMode = true;
    showOfflineBadge();
  } else {
    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      offlineMode = false;
      console.log('⚡ Firebase Firestore & Auth 初始化成功！賀卡將儲存於雲端資料庫。');
    } catch (error) {
      console.error('❌ Firebase 初始化失敗，切換為離線模式:', error);
      offlineMode = true;
      showOfflineBadge();
    }
  }
}

// 顯示離線模式提示徽章
function showOfflineBadge() {
  const badge = document.getElementById('offline-badge');
  if (badge) return;
  
  const newBadge = document.createElement('div');
  newBadge.id = 'offline-badge';
  newBadge.innerHTML = '⚠️ 離線 URL 壓縮模式 (免資料庫)';
  newBadge.style.position = 'fixed';
  newBadge.style.bottom = '15px';
  newBadge.style.left = '15px';
  newBadge.style.background = 'rgba(245, 158, 11, 0.9)';
  newBadge.style.color = '#78350f';
  newBadge.style.padding = '8px 12px';
  newBadge.style.borderRadius = '20px';
  newBadge.style.fontSize = '0.8rem';
  newBadge.style.fontWeight = 'bold';
  newBadge.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
  newBadge.style.zIndex = '999';
  newBadge.style.border = '1px solid rgba(251, 191, 36, 0.4)';
  newBadge.style.backdropFilter = 'blur(5px)';
  document.body.appendChild(newBadge);
}

// ==========================================================================
// Firebase Authentication 驗證與整合 (Firebase Auth Native Integration)
// ==========================================================================
function initFirebaseAuth() {
  if (offlineMode || !auth) {
    // 離線模式直接顯示編輯器，隱藏後台與認證
    document.getElementById('creator-view').classList.remove('hidden');
    document.getElementById('creator-dashboard').classList.add('hidden');
    document.querySelector('.nav-actions').style.display = 'none';
    setupCreator();
    return;
  }

  // 監聽 Firebase Auth 登入狀態變更
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // 使用者已登入
      document.getElementById('auth-view').classList.add('hidden');
      document.getElementById('creator-view').classList.remove('hidden');
      
      // 顯示用戶 Email 資訊，並綁定登出
      document.getElementById('user-display-email').textContent = user.email || '已登入用戶';
      document.getElementById('auth-signout-btn').onclick = async () => {
        showLoading(true);
        await signOut(auth);
        window.location.reload();
      };

      // 載入個人後台 (Dashboard) 與編輯器
      loadCreatorDashboard(user.uid);
      setupCreator(user.uid);
    } else {
      // 使用者未登入
      document.getElementById('creator-view').classList.add('hidden');
      document.getElementById('auth-view').classList.remove('hidden');
      
      setupAuthForm();
    }
  });
}

// 設定原生登入/註冊表單監聽器
function setupAuthForm() {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const authForm = document.getElementById('email-auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const errorMsgDiv = document.getElementById('auth-error-msg');
  const submitBtn = document.getElementById('auth-submit-btn');
  const googleBtn = document.getElementById('google-auth-btn');

  let mode = 'login'; // 'login' 或 'signup'

  // 切換為登入
  tabLogin.onclick = () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    submitBtn.textContent = '登入帳號';
    errorMsgDiv.classList.add('hidden');
  };

  // 切換為註冊
  tabSignup.onclick = () => {
    mode = 'signup';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    submitBtn.textContent = '註冊並登入';
    errorMsgDiv.classList.add('hidden');
  };

  // 錯誤處理訊息中文化
  function getFriendlyErrorMessage(code) {
    switch (code) {
      case 'auth/invalid-email':
        return '❌ 無效的電子郵件格式。';
      case 'auth/user-disabled':
        return '❌ 該帳號已被停用。';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return '❌ 電子郵件或密碼錯誤。';
      case 'auth/email-already-in-use':
        return '❌ 該電子郵件已被註冊使用。';
      case 'auth/weak-password':
        return '❌ 密碼強度不足，請輸入至少 6 位數。';
      case 'auth/popup-closed-by-user':
        return '❌ Google 登入視窗已被關閉。';
      default:
        return `❌ 發生錯誤 (代碼: ${code})，請稍後再試。`;
    }
  }

  // 遞交表單
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    errorMsgDiv.classList.add('hidden');
    showLoading(true);

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
      if (mode === 'signup') {
        // 原生註冊
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // 原生登入
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error('Email 認證錯誤:', err);
      errorMsgDiv.textContent = getFriendlyErrorMessage(err.code);
      errorMsgDiv.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  };

  // Google 一鍵登入
  googleBtn.onclick = async () => {
    errorMsgDiv.classList.add('hidden');
    showLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google 登入錯誤:', err);
      errorMsgDiv.textContent = getFriendlyErrorMessage(err.code);
      errorMsgDiv.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  };
}

// 載入創作者的賀卡 Dashboard
async function loadCreatorDashboard(creatorId) {
  const container = document.getElementById('dashboard-cards-container');
  container.innerHTML = '<div class="spinner" style="margin: 20px auto; grid-column: 1/-1;"></div>';
  
  if (offlineMode) {
    container.innerHTML = `
      <div class="no-cards-fallback">
        <p>⚠️ 目前處於「離線壓縮模式」，後台不支援雲端賀卡列表。您可以在下方直接製作賀卡，系統將直接以網址儲存！</p>
      </div>
    `;
    return;
  }

  try {
    const q = query(collection(db, 'cards'), where('creatorId', '==', creatorId));
    const querySnapshot = await getDocs(q);
    
    container.innerHTML = '';
    
    if (querySnapshot.empty) {
      container.innerHTML = `
        <div class="no-cards-fallback">
          <p>您尚未製作任何雲端生日賀卡。點擊下方「製作新賀卡」開始吧！</p>
        </div>
      `;
      return;
    }

    querySnapshot.forEach((doc) => {
      const card = doc.data();
      const cardId = doc.id;
      const cardUrl = `${window.location.origin}${window.location.pathname}?id=${cardId}`;
      
      const cardElement = document.createElement('div');
      cardElement.className = 'dashboard-card';
      
      // 計算過期狀態
      let expiryLabel = '永久保存';
      let expiryClass = 'expiry-active';
      
      if (card.expiresAt) {
        const expiresMs = card.expiresAt.toDate().getTime();
        const diffMs = expiresMs - new Date().getTime();
        
        if (diffMs <= 0) {
          expiryLabel = '❌ 已過期';
          expiryClass = 'expiry-expired';
        } else {
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          expiryLabel = `⏳ 剩餘 ${diffDays} 天`;
          expiryClass = diffDays <= 2 ? 'expiry-soon' : 'expiry-active';
        }
      }

      // 主題繁體中文字
      const themeNames = {
        'theme-pastel-rose': '溫馨粉金',
        'theme-midnight-aurora': '星空極光',
        'theme-pixel-retro': '復古像素',
        'theme-cyber-party': '賽博派對',
        'theme-minimalist-paper': '日系紙藝'
      };
      const themeLabel = themeNames[card.theme] || '自訂主題';

      // 截斷長祝福語
      const msgSnippet = card.message.length > 50 ? card.message.substring(0, 50) + '...' : card.message;

      cardElement.innerHTML = `
        <div class="db-card-header">
          <span class="db-card-to">To: ${card.recipient}</span>
          <span class="db-card-theme-badge">${themeLabel}</span>
        </div>
        <div class="db-card-body">
          <p class="db-card-snippet">${msgSnippet}</p>
          <span class="db-card-expiry ${expiryClass}">${expiryLabel}</span>
        </div>
        <div class="db-card-actions">
          <button class="db-btn db-btn-copy" data-url="${cardUrl}"><i data-lucide="copy"></i> 複製連結</button>
          <button class="db-btn db-btn-delete" data-id="${cardId}"><i data-lucide="trash-2"></i> 刪除</button>
        </div>
      `;
      
      container.appendChild(cardElement);
    });

    lucide.createIcons();

    // 綁定複製按鈕
    container.querySelectorAll('.db-btn-copy').forEach(btn => {
      btn.onclick = () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          const origText = btn.innerHTML;
          btn.innerHTML = '<i data-lucide="check"></i> 已複製';
          lucide.createIcons();
          setTimeout(() => {
            btn.innerHTML = origText;
            lucide.createIcons();
          }, 2000);
        });
      };
    });

    // 綁定刪除按鈕
    container.querySelectorAll('.db-btn-delete').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('確定要永久刪除此生日賀卡嗎？刪除後連結將立即失效，且無法復原。')) {
          try {
            await deleteDoc(doc(db, 'cards', id));
            playPopSound();
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.8 }
            });
            // 重新載入列表
            loadCreatorDashboard(creatorId);
          } catch (deleteError) {
            console.error('刪除卡片失敗:', deleteError);
            alert('刪除失敗，這張卡片可能已過期或您無權限刪除。');
          }
        }
      };
    });

  } catch (error) {
    console.error('讀取創作者賀卡列表錯誤:', error);
    container.innerHTML = `
      <div class="no-cards-fallback">
        <p>❌ 讀取賀卡清單失敗。請確認 Firebase Firestore 安全性規則已設定。</p>
      </div>
    `;
  }
}

// ==========================================================================
// 音效合成模組 (Web Audio API Sound Synthesizer)
// ==========================================================================
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// 合成氣球/開箱/刪除音效
function playPopSound() {
  try {
    initAudioContext();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioContext.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.5, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.error('播放 Pop 音效失敗:', e);
  }
}

// 合成吹熄蠟燭「噓」音效
function playBlowSound() {
  try {
    initAudioContext();
    const bufferSize = audioContext.sampleRate * 0.2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.4, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    
    noise.start();
    noise.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.error('播放吹熄音效失敗:', e);
  }
}

// 合成歡呼拍手聲效果
function playCheerSound() {
  try {
    initAudioContext();
    const freqs = [330, 440, 554, 659];
    freqs.forEach((f, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = f;
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05 + index * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
      
      osc.start(audioContext.currentTime + index * 0.02);
      osc.stop(audioContext.currentTime + 0.6);
    });
  } catch (e) {
    console.error('播放歡呼音效失敗:', e);
  }
}

// ==========================================================================
// 賀卡編輯器邏輯 (Creator Mode Logic)
// ==========================================================================
function setupCreator(creatorId = null) {
  const form = document.getElementById('card-form');
  const recipientInput = document.getElementById('recipient-input');
  const senderInput = document.getElementById('sender-input');
  const messageInput = document.getElementById('message-input');
  const expiryInput = document.getElementById('expiry-input');
  const scratchPrizeInput = document.getElementById('scratch-prize-input');
  const scratchToggle = document.getElementById('game-scratch-toggle');
  const scratchGroup = document.querySelector('.scratch-prize-group');
  const musicInput = document.getElementById('music-input');
  const customMusicGroup = document.querySelector('.custom-music-group');
  const customMusicUrl = document.getElementById('custom-music-url');
  
  const previewTo = document.getElementById('preview-to');
  const previewWindow = document.getElementById('card-preview-window');

  // 後台「製作新賀卡」滾動按鈕
  const showEditorBtn = document.getElementById('show-editor-btn');
  if (showEditorBtn) {
    showEditorBtn.onclick = () => {
      document.getElementById('editor-form-container').scrollIntoView({ behavior: 'smooth' });
    };
  }
  
  // 監聽即時預覽
  recipientInput.oninput = () => {
    previewTo.textContent = recipientInput.value || '壽星名字';
  };
  
  // 監聽主題切換
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.onchange = (e) => {
      previewWindow.className = 'card-preview-window';
      previewWindow.classList.add(e.target.value);
      document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
      e.target.closest('.theme-option').classList.add('active');
    };
  });
  
  // 監聽祝福語範本
  document.querySelectorAll('.template-tag').forEach(tag => {
    tag.onclick = () => {
      messageInput.value = tag.getAttribute('data-msg');
      saveDraft();
    };
  });

  // 監聽刮刮樂遊戲切換
  scratchToggle.onchange = () => {
    if (scratchToggle.checked) {
      scratchGroup.classList.remove('hidden');
    } else {
      scratchGroup.classList.add('hidden');
    }
  };

  // 監聽背景音樂選擇
  musicInput.onchange = () => {
    if (musicInput.value === 'music-custom') {
      customMusicGroup.classList.remove('hidden');
      customMusicUrl.setAttribute('required', 'required');
    } else {
      customMusicGroup.classList.add('hidden');
      customMusicUrl.removeAttribute('required');
    }
  };

  // 讀取 LocalStorage 草稿
  loadDraft();

  // 監聽輸入以存為草稿
  form.oninput = saveDraft;
  scratchToggle.addEventListener('change', saveDraft);
  musicInput.addEventListener('change', saveDraft);

  // 表單送出，生成賀卡連結
  form.onsubmit = async (e) => {
    e.preventDefault();
    showLoading(true);

    const theme = document.querySelector('input[name="theme"]:checked').value;
    const expiryDays = parseInt(expiryInput.value);
    
    // 計算過期日期
    let expiresAtDate = null;
    if (expiryDays !== 999) {
      expiresAtDate = new Date();
      expiresAtDate.setDate(expiresAtDate.getDate() + expiryDays);
    }

    const cardPayload = {
      recipient: recipientInput.value,
      sender: senderInput.value,
      message: messageInput.value,
      theme: theme,
      games: {
        candle: document.getElementById('game-candle-toggle').checked,
        scratch: scratchToggle.checked,
        balloons: document.getElementById('game-balloons-toggle').checked
      },
      scratchPrize: scratchToggle.checked ? scratchPrizeInput.value || '神秘大獎一份！' : '',
      music: musicInput.value,
      customMusicUrl: musicInput.value === 'music-custom' ? customMusicUrl.value : '',
      createdAt: new Date().getTime(),
      expiresAt: expiresAtDate ? expiresAtDate.getTime() : null,
      creatorId: creatorId // 綁定創作者 ID (Firebase Auth 提供)
    };

    let shareUrl = '';

    if (!offlineMode && creatorId) {
      // Firebase 雲端儲存
      try {
        const docRef = await addDoc(collection(db, 'cards'), {
          ...cardPayload,
          createdAt: Timestamp.now(),
          expiresAt: expiresAtDate ? Timestamp.fromDate(expiresAtDate) : null
        });
        shareUrl = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
        
        // 成功後刷新後台列表
        loadCreatorDashboard(creatorId);
      } catch (err) {
        console.error('寫入 Firebase 失敗，切換為 URL 壓縮模式:', err);
        shareUrl = generateOfflineLink(cardPayload);
      }
    } else {
      // 離線 URL 壓縮儲存
      shareUrl = generateOfflineLink(cardPayload);
    }

    showLoading(false);
    showShareModal(shareUrl, expiryDays);
  };
}

// 產生離線壓縮連結
function generateOfflineLink(payload) {
  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(jsonStr);
  return `${window.location.origin}${window.location.pathname}?card=${compressed}`;
}

// 儲存草稿
function saveDraft() {
  const theme = document.querySelector('input[name="theme"]:checked')?.value || 'theme-pastel-rose';
  const draft = {
    recipient: document.getElementById('recipient-input').value,
    sender: document.getElementById('sender-input').value,
    message: document.getElementById('message-input').value,
    theme: theme,
    candle: document.getElementById('game-candle-toggle').checked,
    scratch: document.getElementById('game-scratch-toggle').checked,
    scratchPrize: document.getElementById('scratch-prize-input').value,
    balloons: document.getElementById('game-balloons-toggle').checked,
    music: document.getElementById('music-input').value,
    customMusicUrl: document.getElementById('custom-music-url').value,
  };
  localStorage.setItem('birthday_card_draft', JSON.stringify(draft));
}

// 載入草稿
function loadDraft() {
  const draftStr = localStorage.getItem('birthday_card_draft');
  if (!draftStr) return;
  try {
    const draft = JSON.parse(draftStr);
    document.getElementById('recipient-input').value = draft.recipient || '';
    document.getElementById('sender-input').value = draft.sender || '';
    document.getElementById('message-input').value = draft.message || '';
    
    document.getElementById('preview-to').textContent = draft.recipient || '壽星名字';

    if (draft.theme) {
      const radio = document.querySelector(`input[name="theme"][value="${draft.theme}"]`);
      if (radio) {
        radio.checked = true;
        const previewWindow = document.getElementById('card-preview-window');
        previewWindow.className = 'card-preview-window';
        previewWindow.classList.add(draft.theme);
        
        document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
        radio.closest('.theme-option').classList.add('active');
      }
    }

    document.getElementById('game-candle-toggle').checked = draft.candle !== false;
    document.getElementById('game-scratch-toggle').checked = draft.scratch !== false;
    document.getElementById('scratch-prize-input').value = draft.scratchPrize || '';
    
    const scratchGroup = document.querySelector('.scratch-prize-group');
    if (draft.scratch !== false) {
      scratchGroup.classList.remove('hidden');
    } else {
      scratchGroup.classList.add('hidden');
    }

    document.getElementById('game-balloons-toggle').checked = draft.balloons !== false;
    document.getElementById('music-input').value = draft.music || 'music-piano-hbd';
    document.getElementById('custom-music-url').value = draft.customMusicUrl || '';
    if (draft.music === 'music-custom') {
      document.querySelector('.custom-music-group').classList.remove('hidden');
    }
  } catch (e) {
    console.error('載入草稿錯誤:', e);
  }
}

// 顯示分享視窗 (Modal)
function showShareModal(url, expiryDays) {
  const modal = document.getElementById('share-modal');
  const urlOutput = document.getElementById('share-url-output');
  const expText = document.querySelector('.expiration-info-text');
  const previewBtn = document.getElementById('preview-link-btn');

  urlOutput.value = url;
  previewBtn.href = url;

  if (expiryDays === 999) {
    expText.textContent = '此連結為永久有效。';
    expText.style.color = '#10b981';
  } else {
    expText.textContent = `⚠️ 重要提示：此連結將在 ${expiryDays} 天後過期並自動被刪除銷毀。`;
    expText.style.color = '#ef4444';
  }

  modal.classList.add('show');

  const closeBtn = document.querySelector('.close-modal-btn');
  const closeHandler = () => {
    modal.classList.remove('show');
    closeBtn.removeEventListener('click', closeHandler);
  };
  closeBtn.addEventListener('click', closeHandler);

  const copyBtn = document.getElementById('copy-url-btn');
  copyBtn.innerHTML = '<i data-lucide="copy"></i> 複製';
  lucide.createIcons();
  
  copyBtn.onclick = () => {
    urlOutput.select();
    urlOutput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(urlOutput.value).then(() => {
      copyBtn.innerHTML = '<i data-lucide="check"></i> 已複製';
      lucide.createIcons();
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy"></i> 複製';
        lucide.createIcons();
      }, 2000);
    });
  };
}

// ==========================================================================
// 賀卡展示器邏輯 (Viewer Mode Logic)
// ==========================================================================
async function loadCardViewer(docId, compressedData) {
  showLoading(true);
  let cardData = null;

  if (docId) {
    if (offlineMode) {
      showExpiredScreen('無法讀取卡片：伺服器未設定金鑰。');
      showLoading(false);
      return;
    }
    try {
      const docSnap = await getDoc(doc(db, 'cards', docId));
      if (docSnap.exists()) {
        cardData = docSnap.data();
        if (cardData.expiresAt) {
          cardData.expiresAtMs = cardData.expiresAt.toDate().getTime();
        }
      }
    } catch (err) {
      console.error('從 Firebase 讀取賀卡失敗:', err);
    }
  } else if (compressedData) {
    try {
      const jsonStr = LZString.decompressFromEncodedURIComponent(compressedData);
      if (jsonStr) {
        cardData = JSON.parse(jsonStr);
        if (cardData.expiresAt) {
          cardData.expiresAtMs = cardData.expiresAt;
        }
      }
    } catch (err) {
      console.error('URL 解壓縮失敗:', err);
    }
  }

  showLoading(false);

  if (!cardData) {
    showExpiredScreen('賀卡不存在或讀取失敗。可能連結有誤。');
    return;
  }

  if (cardData.expiresAtMs && new Date().getTime() > cardData.expiresAtMs) {
    showExpiredScreen();
    return;
  }

  currentCardData = cardData;
  renderViewerStage();
}

// 渲染卡片展示頁面
function renderViewerStage() {
  const viewerSection = document.getElementById('viewer-view');
  
  viewerSection.className = 'view-section';
  viewerSection.classList.add(currentCardData.theme || 'theme-pastel-rose');

  setupBackgroundMusic();

  document.getElementById('viewer-to-envelope').textContent = currentCardData.recipient;
  document.getElementById('viewer-to-name').textContent = currentCardData.recipient;
  document.getElementById('viewer-from-name').textContent = currentCardData.sender;
  document.getElementById('viewer-message').textContent = currentCardData.message;

  document.getElementById('viewer-scratch-from').textContent = currentCardData.sender;
  document.getElementById('viewer-scratch-prize').textContent = currentCardData.scratchPrize || '神秘驚喜！';

  document.getElementById('creator-view').classList.add('hidden');
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('viewer-view').classList.remove('hidden');

  createBackgroundParticles();

  const envelope = document.querySelector('.envelope-container-3d');
  const newEnvelope = envelope.cloneNode(true);
  envelope.parentNode.replaceChild(newEnvelope, envelope);

  newEnvelope.addEventListener('click', () => {
    const envInner = newEnvelope.querySelector('.envelope-3d');
    if (!envInner.classList.contains('open')) {
      envInner.classList.add('open');
      playPopSound();
      
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        document.getElementById('opening-stage').classList.add('hidden');
        document.getElementById('card-stage').classList.remove('hidden');
        
        playMusic();

        if (currentCardData.games?.balloons) {
          startBalloonSpawner();
        }
      }, 1200);
    }
  });

  setupStepNavigation();
}

// 動態背景星塵
function createBackgroundParticles() {
  const container = document.getElementById('background-particles');
  container.innerHTML = '';
  const numParticles = 25;
  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('div');
    p.className = 'bg-particle';
    const size = Math.random() * 8 + 4;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.animationDelay = `${Math.random() * 15}s`;
    p.style.animationDuration = `${Math.random() * 10 + 10}s`;
    
    container.appendChild(p);
  }
}

// 背景音樂控制
function setupBackgroundMusic() {
  bgMusicElement = document.getElementById('bg-music');
  const controlBtn = document.getElementById('music-control');
  
  let musicUrl = '';
  if (currentCardData.music === 'music-custom') {
    musicUrl = currentCardData.customMusicUrl;
  } else {
    musicUrl = MUSIC_SOURCES[currentCardData.music] || MUSIC_SOURCES['music-piano-hbd'];
  }

  bgMusicElement.src = musicUrl;
  controlBtn.classList.remove('hidden');
  controlBtn.classList.remove('playing');
  isMusicPlaying = false;

  controlBtn.onclick = () => {
    initAudioContext();
    if (isMusicPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  };
}

function playMusic() {
  if (bgMusicElement && bgMusicElement.src) {
    bgMusicElement.play().then(() => {
      isMusicPlaying = true;
      document.getElementById('music-control').classList.add('playing');
    }).catch(err => {
      console.warn('自動撥放音樂被瀏覽器阻擋，須使用者手動互動:', err);
    });
  }
}

function pauseMusic() {
  if (bgMusicElement) {
    bgMusicElement.pause();
    isMusicPlaying = false;
    document.getElementById('music-control').classList.remove('playing');
  }
}

// 步驟轉場設定
function setupStepNavigation() {
  const gotoCakeBtn = document.getElementById('goto-cake-btn');
  const gotoScratchBtn = document.getElementById('goto-scratch-btn');
  const gotoFinalBtn = document.getElementById('goto-final-btn');
  const replayBtn = document.getElementById('replay-btn');
  const goEditorBtn = document.getElementById('go-to-editor-btn');

  gotoCakeBtn.onclick = () => {
    document.getElementById('step-letter').classList.add('hidden');
    if (currentCardData.games?.candle) {
      document.getElementById('step-cake').classList.remove('hidden');
      initCandleGame();
    } else if (currentCardData.games?.scratch) {
      document.getElementById('step-scratch').classList.remove('hidden');
      initScratchGame();
    } else {
      document.getElementById('step-final').classList.remove('hidden');
      triggerFinalCelebration();
    }
  };

  gotoScratchBtn.onclick = () => {
    document.getElementById('step-cake').classList.add('hidden');
    stopMicDetection();

    if (currentCardData.games?.scratch) {
      document.getElementById('step-scratch').classList.remove('hidden');
      initScratchGame();
    } else {
      document.getElementById('step-final').classList.remove('hidden');
      triggerFinalCelebration();
    }
  };

  gotoFinalBtn.onclick = () => {
    document.getElementById('step-scratch').classList.add('hidden');
    document.getElementById('step-final').classList.remove('hidden');
    triggerFinalCelebration();
  };

  replayBtn.onclick = () => {
    pauseMusic();
    stopBalloonSpawner();
    stopMicDetection();

    document.getElementById('step-final').classList.add('hidden');
    document.getElementById('card-stage').classList.add('hidden');
    
    const envelope3d = document.querySelector('.envelope-3d');
    envelope3d.classList.remove('open');
    document.getElementById('opening-stage').classList.remove('hidden');

    renderViewerStage();
  };

  goEditorBtn.onclick = () => {
    pauseMusic();
    stopBalloonSpawner();
    stopMicDetection();

    // 移除 URL 參數，返回主畫面 (Firebase 登入首頁/Dashboard)
    window.history.pushState({}, document.title, window.location.pathname);
    
    document.getElementById('viewer-view').classList.add('hidden');
    window.location.reload();
  };
}

// ==========================================================================
// 吹蠟燭遊戲邏輯 (Candle blowing game)
// ==========================================================================
let extinguishedCount = 0;

function initCandleGame() {
  extinguishedCount = 0;
  document.getElementById('goto-scratch-btn').classList.add('hidden');
  
  const candles = document.querySelectorAll('.candle');
  candles.forEach(candle => {
    candle.classList.remove('extinguished');
    candle.querySelector('.flame').style.display = 'block';
    candle.querySelector('.smoke').classList.add('hidden');
    candle.onclick = () => {
      extinguishCandle(candle);
    };
  });

  const micBtn = document.getElementById('mic-enable-btn');
  micBtn.innerHTML = '<i data-lucide="mic"></i> 啟用麥克風吹蠟燭';
  micBtn.classList.remove('hidden');
  document.getElementById('mic-status').textContent = '';
  lucide.createIcons();

  micBtn.onclick = () => {
    startMicDetection();
  };
}

function extinguishCandle(candle) {
  if (candle.classList.contains('extinguished')) return;

  candle.classList.add('extinguished');
  playBlowSound();
  
  const smoke = candle.querySelector('.smoke');
  smoke.classList.remove('hidden');
  
  extinguishedCount++;
  
  const totalCandles = document.querySelectorAll('.candle').length;
  if (extinguishedCount >= totalCandles) {
    stopMicDetection();
    playCheerSound();
    
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      const nextBtn = document.getElementById('goto-scratch-btn');
      nextBtn.classList.remove('hidden');
      if (!currentCardData.games?.scratch) {
        nextBtn.textContent = '完成體驗 🎉';
      } else {
        nextBtn.textContent = '領取神秘禮物 🎁';
      }
    }, 500);
  }
}

async function startMicDetection() {
  const micBtn = document.getElementById('mic-enable-btn');
  const micStatus = document.getElementById('mic-status');

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    initAudioContext();

    micStatus.textContent = '🎙️ 麥克風已啟用！請對著麥克風大力「吹氣」！';
    micBtn.classList.add('hidden');

    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let blowCooldown = false;

    micInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;

      if (averageVolume > 65 && !blowCooldown) {
        blowCooldown = true;
        
        const activeCandles = document.querySelectorAll('.candle:not(.extinguished)');
        if (activeCandles.length > 0) {
          const randomIndex = Math.floor(Math.random() * activeCandles.length);
          extinguishCandle(activeCandles[randomIndex]);
        }

        setTimeout(() => {
          blowCooldown = false;
        }, 300);
      }
    }, 50);

  } catch (err) {
    console.warn('無法使用麥克風，請改用點擊方式:', err);
    micStatus.textContent = '❌ 無法取得麥克風權限，請直接用滑鼠點擊蠟燭！';
  }
}

function stopMicDetection() {
  if (micInterval) {
    clearInterval(micInterval);
    micInterval = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
}

// ==========================================================================
// 刮刮樂 Canvas 遊戲邏輯 (Scratch card game)
// ==========================================================================
function initScratchGame() {
  document.getElementById('goto-final-btn').classList.add('hidden');
  
  const canvas = document.getElementById('scratch-canvas');
  const ctx = canvas.getContext('2d');
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
  
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 25) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 50, canvas.height);
    ctx.stroke();
  }

  ctx.font = 'bold 16px var(--font-sans)';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎂 生日快樂！快刮開我 🎁', canvas.width / 2, canvas.height / 2);

  let isDrawing = false;
  
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function scratch(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getMousePos(e);
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
    ctx.fill();

    if (Math.random() < 0.15) {
      checkScratchPercentage();
    }
  }

  function checkScratchPercentage() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;
    
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i + 3] === 0) {
        transparentCount++;
      }
    }
    
    const totalSampledPixels = pixels.length / 16;
    const percentage = (transparentCount / totalSampledPixels) * 100;
    
    if (percentage > 50) {
      isDrawing = false;
      canvas.style.transition = 'opacity 0.6s ease';
      canvas.style.opacity = '0';
      
      playCheerSound();
      
      setTimeout(() => {
        canvas.style.display = 'none';
        document.getElementById('goto-final-btn').classList.remove('hidden');
      }, 600);
    }
  }

  canvas.onmousedown = (e) => { isDrawing = true; scratch(e); };
  canvas.onmousemove = scratch;
  window.onmouseup = () => { isDrawing = false; };

  canvas.ontouchstart = (e) => { isDrawing = true; scratch(e); };
  canvas.ontouchmove = scratch;
  canvas.ontouchend = () => { isDrawing = false; };
}

// ==========================================================================
// 飄浮氣球小遊戲邏輯 (Balloon floating game)
// ==========================================================================
let balloonInterval = null;

function startBalloonSpawner() {
  stopBalloonSpawner();
  balloonInterval = setInterval(() => {
    spawnBalloon();
  }, 2200);
}

function stopBalloonSpawner() {
  if (balloonInterval) {
    clearInterval(balloonInterval);
    balloonInterval = null;
  }
  const container = document.getElementById('balloon-container');
  container.innerHTML = '';
  spawnedBalloons = [];
}

function spawnBalloon() {
  const container = document.getElementById('balloon-container');
  const balloon = document.createElement('div');
  balloon.className = 'balloon';

  const colors = ['#f43f5e', '#3b82f6', '#8b5cf6', '#eab308', '#f97316', '#10b981'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  balloon.style.backgroundColor = color;
  balloon.style.color = color;

  const sizeMultiplier = Math.random() * 0.4 + 0.8;
  balloon.style.transform = `scale(${sizeMultiplier})`;
  balloon.style.left = `${Math.random() * 85 + 5}vw`;

  const duration = Math.random() * 5 + 8;
  balloon.style.animationDuration = `${duration}s`;

  const string = document.createElement('div');
  string.className = 'balloon-string';
  balloon.appendChild(string);

  balloon.addEventListener('click', (e) => {
    e.stopPropagation();
    popBalloon(balloon);
  });

  container.appendChild(balloon);
  spawnedBalloons.push(balloon);

  setTimeout(() => {
    if (balloon.parentNode) {
      balloon.remove();
      spawnedBalloons = spawnedBalloons.filter(b => b !== balloon);
    }
  }, duration * 1000);
}

function popBalloon(balloon) {
  if (balloon.classList.contains('popping')) return;
  balloon.classList.add('popping');
  
  playPopSound();
  createBalloonParticles(balloon);

  setTimeout(() => {
    balloon.remove();
    spawnedBalloons = spawnedBalloons.filter(b => b !== balloon);
  }, 150);
}

function createBalloonParticles(balloon) {
  const rect = balloon.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const color = balloon.style.backgroundColor;

  const container = document.getElementById('balloon-container');
  const numParticles = 12;

  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('div');
    p.className = 'balloon-particle';
    p.style.backgroundColor = color;
    p.style.left = `${centerX}px`;
    p.style.top = `${centerY}px`;

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 80 + 40;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);

    container.appendChild(p);

    setTimeout(() => {
      p.remove();
    }, 600);
  }
}

// ==========================================================================
// 最終關卡慶祝動畫 (Final Celebration Animation)
// ==========================================================================
function triggerFinalCelebration() {
  playCheerSound();
  let count = 0;
  const interval = setInterval(() => {
    confetti({
      particleCount: 120,
      angle: count % 2 === 0 ? 60 : 120,
      spread: 55,
      origin: { x: count % 2 === 0 ? 0 : 1, y: 0.6 }
    });
    count++;
    if (count >= 3) clearInterval(interval);
  }, 400);
}

// ==========================================================================
// 系統輔助函式 (Helper Functions)
// ==========================================================================
function showLoading(show) {
  const loader = document.getElementById('loading-screen');
  if (show) {
    loader.classList.remove('hidden');
    loader.style.opacity = '1';
  } else {
    loader.style.opacity = '0';
    setTimeout(() => loader.classList.add('hidden'), 500);
  }
}

function showExpiredScreen(customMsg) {
  const expired = document.getElementById('expired-screen');
  if (customMsg) {
    expired.querySelector('p').textContent = customMsg;
  }
  expired.classList.remove('hidden');

  document.getElementById('expired-create-btn').onclick = () => {
    expired.classList.add('hidden');
    window.history.pushState({}, document.title, window.location.pathname);
    window.location.reload();
  };
}

// ==========================================================================
// 路由分發與入口 (Routing & Initialization Entry)
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化 Firebase Firestore 與 Auth
  initFirebase();
  lucide.createIcons();

  // 2. 解析 URL 參數
  const urlParams = new URLSearchParams(window.location.search);
  const cardId = urlParams.get('id');
  const compressedData = urlParams.get('card');

  if (cardId || compressedData) {
    // A. 「收件人模式」：完全略過登入，直接開啟賀卡
    loadCardViewer(cardId, compressedData);
  } else {
    // B. 「創作者模式」：需要登入
    showLoading(false);
    initFirebaseAuth();
  }
});
