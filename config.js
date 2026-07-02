// Firebase 設定檔案
// ==========================================

// 1. Firebase Web 應用程式配置
export const firebaseConfig = {
  apiKey: "AIzaSyDpMp2g4zX10aitRMwZ9DP8ROGGzCmC4xE",
  authDomain: "birthdaycard-8d6a9.firebaseapp.com",
  projectId: "birthdaycard-8d6a9",
  storageBucket: "birthdaycard-8d6a9.firebasestorage.app",
  messagingSenderId: "957762771812",
  appId: "1:957762771812:web:dbc305e32314f589687871"
};

// ==========================================
// 💡 指引：
// 
// [Firebase 登入機制設定]
// 1. 請前往 Firebase 控制台 (https://console.firebase.google.com/)。
// 2. 點擊進入您的專案：birthdaycard-8d6a9。
// 3. 在左側選單點擊 Build > Authentication，然後點擊「開始使用」。
// 4. 啟用以下兩種登入方式：
//    - 「電子郵件/密碼」：開啟並儲存。
//    - 「Google」：開啟，填寫專案的支援電子郵件，然後儲存。
// 
// [Firebase Firestore 安全規則]
// 請在 Firebase Firestore > 規則 (Rules) 貼上以下安全性配置，然後點擊「發佈」：
// 
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /cards/{cardId} {
//       // 任何人都可以讀取卡片（用於壽星拆信）
//       // 只有當前時間小於過期時間時，才允許讀取
//       allow read: if resource == null || resource.data.expiresAt == null || resource.data.expiresAt > request.time;
//       
//       // 只有登入用戶（Firebase Auth）才能建立卡片
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
// [TTL 自動過期銷毀（選用）]
// 1. 前往 Google Cloud 的 Firestore TTL 頁面：https://console.cloud.google.com/firestore/ttl
// 2. 為 `cards` 集合的 `expiresAt` 欄位建立 TTL 規則，即可在時間過期時由雲端自動徹底刪除資料。
