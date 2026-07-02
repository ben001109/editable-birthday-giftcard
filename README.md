# 🎉 動態生日賀卡與創作者管理後台系統 (Clerk + Supabase 整合版)

這是一個完全基於前端網頁運作的「互動式生日賀卡與創作者管理系統」，非常適合免費託管於 **GitHub Pages**。

本專案採用 **Clerk 身份驗證** 作為登入環境，並使用 **Supabase** 作為後端資料庫，實現了安全無伺服器的 Row Level Security (RLS) 行級安全性原則同步。

---

## ✨ 核心特色

1. **🔐 Clerk 身份驗證**
   - 支援 Email、Google、GitHub 等多種登入與註冊方式。
   - 提供右上角 Clerk 原生 User Button 修改個人資料與安全登出。
2. **🛡️ Supabase RLS 安全同步策略**
   - 透過 Clerk 簽發的 Supabase JWT 憑證，Supabase 會在資料庫端直接驗證權限。
   - **完全安全**：任何人皆可讀取卡片（用於拆信封），但只有建立卡片的 Clerk 使用者可以刪除它。
   - **免架設後端**：100% 前端靜態網頁，零風險、零伺服器成本。
3. **📊 創作者管理後台 (Dashboard)**
   - 登入後可查看所有已建立的賀卡。
   - 動態顯示剩餘有效期（例如：`⏳ 剩餘 5 天`、`❌ 已過期`）。
   - 提供「一鍵複製分享連結」與「安全刪除卡片」功能。
4. **🎨 5 套精美視覺主題**
   - **溫馨粉金 (Pastel Rose)**：浪漫柔和的粉金色調。
   - **星空極光 (Midnight Aurora)**：深邃星空與極光波紋。
   - **復古像素 (Pixel Retro)**：可愛的 8-bit 電玩風。
   - **賽博派對 (Cyber Party)**：賽博霓虹風。
   - **日系紙藝 (Minimalist Paper)**：仿手作實體紙張質感。
5. **🎮 豐富的互動小遊戲**
   - **3D 信封開箱**：點擊開箱，Confetti 灑紙屑動畫。
   - **吹熄蛋糕蠟燭**：可用滑鼠點擊熄滅，或啟用麥克風**直接對著螢幕吹氣**熄滅！
   - **驚喜刮刮樂**：Canvas 模擬刮刮樂，刮開揭曉「客製化禮物券」（如：請吃大餐一次）。
   - **飄浮戳氣球**：背景源源不絕飄起氣球，點擊可戳破並產生爆炸顆粒與合成音效。
6. **🎵 Web Audio API 聲效合成**
   - 所有的戳氣球聲、吹熄聲、觀眾歡呼聲，皆由瀏覽器 API **即時運算合成**，無須載入外部 MP3，100% 穩定。

---

## 🚀 快速開始

### 1. 本地執行與開發
複製此專案到您的電腦上，並在根目錄啟動任何靜態伺服器。例如使用 Python：
```bash
python -m http.server 8000
```
瀏覽 [http://localhost:8000](http://localhost:8000) 即可開啟。
*備註：若尚未設定金鑰，系統會自動啟動「離線網址壓縮模式」，直接讓您免資料庫進行製作與測試。*

### 2. 配置金鑰 (`config.js`)
開啟 `config.js`，填入您的 Supabase URL、Anon Key 及 Clerk Publishable Key：
```javascript
export const supabaseUrl = "YOUR_SUPABASE_URL";
export const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";
export const clerkPublishableKey = "pk_test_cHJlcGFyZWQtaGFsaWJ1dC0yLmNsZXJrLmFjY291bnRzLmRldiQ"; // 您的 Clerk Key
```

---

## 🔒 Supabase 與 Clerk 安全整合設定

為了在您的生產環境中啟用完整的安全保護，請依序設定：

### 1. 建立 Supabase 資料表 (SQL)
在 Supabase 控制台的 **SQL Editor** 新增 Query 並執行以下腳本：
```sql
create table public.cards (
  id uuid default gen_random_uuid() primary key,
  recipient text not null,
  sender text not null,
  message text not null,
  theme text not null,
  games jsonb not null,
  scratch_prize text,
  music text,
  custom_music_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone,
  creator_id text not null
);

alter table public.cards enable row level security;

-- 政策 1: 任何人皆可讀取未過期的賀卡 (供壽星拆信)
create policy "Anyone can read unexpired cards"
on public.cards for select
using (expires_at is null or expires_at > now());

-- 政策 2: 只有經 Clerk 驗證的用戶可以建立卡片
create policy "Authenticated users can insert cards"
on public.cards for insert
with check (auth.jwt() ->> 'sub' = creator_id);

-- 政策 3: 只有卡片擁有者可以刪除卡片
create policy "Users can delete their own cards"
on public.cards for delete
using (auth.jwt() ->> 'sub' = creator_id);
```

### 2. 在 Clerk 設定 Supabase JWT 模板
1. 前往 **Supabase 控制台 > Project Settings > API**。
2. 複製 **JWT Settings** 區塊中的 **JWT Secret**（密鑰）。
3. 前往 **Clerk 控制台 > JWT Templates**。
4. 點擊 **New template**，選擇 **Supabase**。
5. 將 Supabase 的 **JWT Secret** 貼入 **Signing key** 欄位中，然後點擊 **Save**（維持模板名稱為 `supabase`）。

---

## 📦 部署至 GitHub Pages

1. 將此專案推送 (push) 至您的 GitHub 倉庫。
2. 進入該倉庫的 **Settings > Pages**。
3. 設定 Source 為 **Deploy from a branch**，將 Branch 設定為 `main` (或 `master`) 的 `/ (root)`，點擊 **Save**。
4. 稍等約一分鐘，您即可透過 `https://<您的帳號>.github.io/<倉庫名稱>/` 造訪線上系統！
