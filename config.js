// Firebase 與 Clerk 設定檔案
// ==========================================

// 1. Firebase 設定
// 請至 Firebase 控制台 (https://console.firebase.google.com/) 建立專案
// 並在專案設定中建立一個 Web 應用程式，將產生的配置貼在下方：
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2. Clerk 身份驗證設定
// 請至 Clerk 控制台 (https://clerk.com/) 建立專案
// 在 API Keys 頁面複製 Publishable key 貼在下方：
export const clerkPublishableKey = "YOUR_CLERK_PUBLISHABLE_KEY";

// ==========================================
// 💡 指引：
// 
// [Firebase Firestore 整合安全規則]
// 請在 Firebase Firestore 中建立名為 "cards" 的 Collection，並設定以下「安全規則」(Rules)：
// 
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /cards/{cardId} {
//       // 任何人都可以讀取卡片（用於壽星拆信）
//       // 建議加入時間判定，只有未過期的卡片才能讀取
//       allow read: if resource == null || resource.data.expiresAt == null || resource.data.expiresAt > request.time;
//       
//       // 只有登入用戶（Clerk 同步）才能建立卡片
//       allow create: if request.auth != null;
//       
//       // 只有卡片擁有者才能刪除卡片
//       allow delete: if request.auth != null && resource.data.creatorId == request.auth.uid;
//       
//       // 本系統卡片不開放修改
//       allow update: if false;
//     }
//   }
// }
//
// [Clerk & Firebase 整合設定]
// 1. 前往 Clerk 控制台 > Integrations > Firebase。
// 2. 啟用 Firebase Integration 並點擊 Save。
// 3. 在 Firebase 控制台 > Project Settings > Service Accounts，新增或下載一個私鑰金鑰。
// 4. 將 Firebase 的 Service Account 配置填入 Clerk 整合介面中。
// 5. 這將允許 Clerk 自動簽發 Firebase 的 JWT Custom Token，實現前端無縫安全的雙網聯邦認證。
