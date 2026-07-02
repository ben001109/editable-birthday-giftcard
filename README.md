# 🎉 動態生日賀卡與創作者管理後台系統 (B-Day Giftcard)

這是一個完全基於前端網頁運作的「互動式生日賀卡與創作者管理系統」，非常適合免費託管於 **GitHub Pages**。

使用者（賀卡創作者）可以登入後台自訂賀卡內容、選擇主題風格與互動小遊戲；系統會將資料安全儲存於 **Firebase**，並生成專屬連結。收件人點擊連結後即可體驗 3D 拆信封、吹蠟燭、刮刮樂等精美互動。

---

## ✨ 核心特色

1. **🔐 Firebase Auth 原生驗證**
   - 支援「電子郵件/密碼」註冊與登入。
   - 支援 「Google 帳號一鍵登入」（彈出視窗模式）。
   - 完全不需要額外的後端伺服器。
2. **📊 創作者管理後台 (Dashboard)**
   - 登入後可查看所有已建立的賀卡。
   - 動態顯示剩餘有效期（例如：`⏳ 剩餘 5 天`、`❌ 已過期`）。
   - 提供「一鍵複製分享連結」與「安全刪除卡片」功能。
3. **🎨 5 套精美視覺主題**
   - **溫馨粉金 (Pastel Rose)**：浪漫柔和的粉金色調。
   - **星空極光 (Midnight Aurora)**：深邃星空與極光波紋。
   - **復古像素 (Pixel Retro)**：童趣可愛的 8-bit 電玩風。
   - **賽博派對 (Cyber Party)**：炫目科幻的霓虹紫與賽博藍。
   - **日系紙藝 (Minimalist Paper)**：仿實體手作紙張紋理與柔和陰影。
4. **🎮 豐富的互動小遊戲**
   - **3D 信封開箱**：點擊信封口，信封蓋向上旋轉翻開，卡片緩緩滑出，並噴灑五彩紙屑 (Confetti)。
   - **吹熄蛋糕蠟燭**：可以使用滑鼠點擊熄滅，或啟用麥克風**直接對著螢幕吹氣**熄滅！
   - **驚喜刮刮樂**：使用 Canvas 模擬刮刮樂，刮開超過 50% 會揭曉創作者填寫的「客製化禮物券」（如：請吃大餐一次）。
   - **飄浮戳氣球**：背景源源不絕飄起氣球，點擊可將它戳破並產生爆炸顆粒。
5. **🎵 Web Audio API 聲效合成**
   - 所有的戳氣球聲、吹熄聲、觀眾歡呼聲，皆由瀏覽器 API **即時運算合成**，無須載入外部 MP3，100% 穩定且不會遺失。

---

## 🚀 快速開始

### 1. 本地執行與開發
複製此專案到您的電腦上，並在根目錄啟動任何靜態伺服器。例如使用 Python：
```bash
python -m http.server 8000
```
瀏覽 [http://localhost:8000](http://localhost:8000) 即可開啟。
*備註：若尚未設定 Firebase 金鑰，系統會自動啟動「離線網址壓縮模式」，直接讓您免資料庫進行製作與測試。*

### 2. 配置金鑰 (`config.js`)
開啟 `config.js`，將您的 Firebase Web 設定貼入其中：
```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🔒 Firebase 安全設定

請在 Firebase 控制台完成以下設定，以確保後台管理安全性：

### 1. 啟用驗證方式 (Authentication)
前往 **Firebase Authentication > Sign-in method**，啟用：
- **電子郵件/密碼**。
- **Google**（須設定專案支援電子郵件）。

### 2. 設定 Firestore 安全規則 (Rules)
前往 **Firebase Firestore > Rules**，貼上以下安全性配置：
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cards/{cardId} {
      // 任何人皆可讀取未過期的卡片 (用於收件人看信)
      allow read: if resource == null || resource.data.expiresAt == null || resource.data.expiresAt > request.time;
      
      // 只有登入用戶能建立卡片
      allow create: if request.auth != null;
      
      // 只有卡片擁有者 (creatorId) 可以刪除卡片
      allow delete: if request.auth != null && resource.data.creatorId == request.auth.uid;
      
      // 不開放更新修改
      allow update: if false;
    }
  }
}
```

### 3. 設定 TTL 自動刪除規則（選用）
前往 [Firestore TTL 管理頁面](https://console.cloud.google.com/firestore/ttl)，為 `cards` 集合的 `expiresAt` 欄位建立 TTL 規則，到期時資料庫便會自動永久銷毀該筆資料。

---

## 📦 部署至 GitHub Pages

1. 在 GitHub 建立一個公開倉庫 (Public Repository)。
2. 將此專案的所有檔案推送 (push) 至該倉庫。
3. 進入該倉庫的 **Settings > Pages**。
4. 設定 Source 為 **Deploy from a branch**，將 Branch 設定為 `main` (或 `master`) 的 `/ (root)`，點擊 **Save**。
5. 稍等約一分鐘，您即可透過 `https://<您的帳號>.github.io/<倉庫名稱>/` 造訪線上系統！
