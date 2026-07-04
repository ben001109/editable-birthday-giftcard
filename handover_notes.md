# 專屬動態生日賀卡系統 - Arch Linux 移轉與開發交接說明

這份文件旨在協助您將本專案 (`editable-birthday-giftcard`) 順利移轉至 **Arch Linux** 系統，並說明目前專案的最新狀態、資料庫 Schema 變動與後續開發指引。

---

## 1. 專案現況與架構簡介

*   **專案類型**：純前端響應式單頁應用 (Vanilla JS SPA)，不需額外的 Node.js 建置框架（無 React/Vue，以極速載入與簡約為導向）。
*   **託管與部署**：使用 GitHub Pages 進行靜態部署，並配置 GitHub Actions 自動發布。
*   **第三方服務整合**：
    *   **Clerk**：負責創作者註冊、登入及 Session 管理。
    *   **Supabase**：提供雲端資料庫儲存。使用動態 `fetch` 攔截器直接繞過過期 JWT (解決 `JWT expired` 401 錯誤)。
*   **最新版本**：`v1.3.1` (Git Tag)。

---

## 2. 核心功能與改動摘要 (至 v1.3.1)

1.  **高質感護眼深色模式 (v1.3.1)**：
    *   管理後台與編輯器從原本刺眼的全白，改為現代深色玻璃霓虹質感 (`#0b0f19` 背景色、`rgba(17,24,39,0.65)` 卡片底色)。
    *   所有輸入表單元素皆已深色化，並加強 focus 時的粉色光暈提示。
    *   Clerk 登入面板透過 API 參數注入自訂 appearance 變數，實現完美深色一體化。
2.  **賀卡編輯與鎖定解鎖功能 (v1.3.1)**：
    *   管理後台為每張卡片新增了「編輯」與「鎖定/解鎖」按鈕。
    *   **編輯功能**：點擊編輯可將該卡片欄位帶回左側表單，表單提交轉為 `UPDATE` 模式，避免重複生成新連結。
    *   **鎖定功能**：透過 Toggle 修改 Supabase 的 `is_locked` 欄位。卡片一旦鎖定，後台編輯按鈕將會隱藏，防止誤觸修改。
3.  **黑白素墨主題 (`theme-mono-ink`) (v1.3.0)**：
    *   新增具備經典手寫線條紙張與黑白單色調質感的主題风格。
4.  **即時重置與草稿清除 (v1.3.0)**：
    *   點擊「製作新賀卡」時，會完整重置表單、還原預覽、並清除 `localStorage` 內暫存的草稿。
5.  **社群媒體分享優化 (v1.2.0)**：
    *   置入了 OG (Open Graph) 及 Twitter Card meta tags，並生成了最適大小與比例的預覽圖片 `og-preview.png`，確保 LINE / FB 預覽圖完美呈現。

---

## 3. Supabase 資料庫設定 (SQL)

為了支援「鎖定」與「編輯」功能，Supabase 中的 `cards` 資料表必須建立對應的欄位與 RLS 策略。請在 Supabase 的 **SQL Editor** 執行以下腳本：

```sql
-- 1. 建立或確認 cards 基本資料表
create table if not exists public.cards (
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

-- 2. 擴充 is_locked 欄位 (支援卡片編輯鎖定狀態)
alter table public.cards 
add column if not exists is_locked boolean default false;

-- 3. 啟用 Row Level Security (RLS) 安全策略
alter table public.cards enable row level security;

-- 4. 設定 RLS 政策 (依據 Clerk Native Auth 整合設定)

-- 政策 A: 允許任何人讀取未過期的賀卡 (供壽星拆信)
create policy "Anyone can read unexpired cards"
on public.cards for select
using (expires_at is null or expires_at > now());

-- 政策 B: 只有經 Clerk 驗證的用戶可以建立卡片
create policy "Authenticated users can insert cards"
on public.cards for insert
with check (auth.jwt() ->> 'sub' = creator_id);

-- 政策 C: 只有卡片擁有者可以更新自己的卡片 (編輯/鎖定狀態變更)
create policy "Users can update their own cards"
on public.cards for update
using (auth.jwt() ->> 'sub' = creator_id);

-- 政策 D: 只有卡片擁有者可以刪除自己的卡片
create policy "Users can delete their own cards"
on public.cards for delete
using (auth.jwt() ->> 'sub' = creator_id);
```

> **關於 Clerk + Supabase 的 Native Auth 整合**
> 目前已捨棄傳統 HS256 JWT Template。由於 Supabase 已改用 **ES256 (JWKS)** 不對稱加密，必須在 Supabase > Settings > Auth 設定中加入您的 Clerk JWKS 網域進行對接（即 `prepared-halibut-2.clerk.accounts.dev`），如此 `auth.jwt()` 才能順利解析出 `creator_id`。

---

## 4. Arch Linux 開發環境配置步驟

請在您的 Arch Linux 系統上依序執行以下步驟來部署開發環境：

### 步驟 1：安裝基礎工具
打開終端機，更新系統並安裝 Git、Node.js、npm 以及 GitHub CLI (選用)：
```bash
sudo pacman -Syu
sudo pacman -S git nodejs npm github-cli
```

### 步驟 2：複製專案儲存庫
將專案複製到您的本地 Linux 工作區：
```bash
git clone https://github.com/ben001109/editable-birthday-giftcard.git
cd editable-birthday-giftcard
```

### 步驟 3：安裝與運行本地開發伺服器
因為此專案使用 ES Modules (`type="module"`)，必須在本地 Web 伺服器環境中運行，無法直接用瀏覽器打開本地的 `.html` 檔案。

您可以使用一個極簡的本地伺服器工具（例如 `serve` 或 `http-server`）：
```bash
# 全域安裝極簡開發伺服器
sudo npm install -g serve

# 在專案根目錄下啟動
serve .
```
啟動後，瀏覽器打開 `http://localhost:3000` (或控制台輸出的 Port) 即可進行本地開發與即時預覽。

---

## 5. 常見維護指令與技巧

*   **推播並觸發 GitHub Pages 部署**：
    ```bash
    git add .
    git commit -m "your commit message"
    git push origin main
    ```
    *如果 GitHub Pages 部署過程出現 503 服務不穩定，您可以利用空 commit 重新觸發部署：*
    ```bash
    git commit --allow-empty -m "Chore: Retry deployment"
    git push
    ```

*   **版本號發布與 Tag 標記**：
    ```bash
    # 建立新版本 tag (例如 v1.3.2)
    git tag v1.3.2 -m "Release description"
    # 推送 tags 至遠端
    git push origin --tags
    ```

*   **LINE/FB 快取刷新**：
    如果分享連結時預覽縮圖沒有更新，請使用下列調試工具強制清除 LINE / FB 伺服器的快取：
    *   **LINE 縮圖快取刷新**：前往 [LINE PagePoker](https://poker.line.naver.jp/) 貼上網址並點擊 Clear Cache。
    *   **Facebook 偵錯工具**：前往 [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/) 點擊「再次抓取」。
