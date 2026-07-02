// Supabase 與 Clerk 設定檔案
// ==========================================

// 1. Supabase 設定
// 已成功設定您的 Supabase 專案 (ref: aiqvsvgobxldtmqsphfm)
export const supabaseUrl = "https://aiqvsvgobxldtmqsphfm.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcXZzdmdvYnhsZHRtcXNwaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDg4OTUsImV4cCI6MjA5ODU4NDg5NX0.OHDA4UOMzrzCdMYfwGu7VPrpSwLyPTCRdeQK3NyHAAA";

// 2. Clerk 身份驗證設定
// 已設定您的 Clerk 專案 Publishable Key
export const clerkPublishableKey = "pk_test_cHJlcGFyZWQtaGFsaWJ1dC0yLmNsZXJrLmFjY291bnRzLmRldiQ";

// ==========================================
// 💡 指引：
// 
// [Supabase 資料表設定 (SQL)]
// 請在 Supabase 控制台的 SQL Editor 中執行以下腳本來建立資料表：
// 
// create table public.cards (
//   id uuid default gen_random_uuid() primary key,
//   recipient text not null,
//   sender text not null,
//   message text not null,
//   theme text not null,
//   games jsonb not null,
//   scratch_prize text,
//   music text,
//   custom_music_url text,
//   created_at timestamp with time zone default timezone('utc'::text, now()) not null,
//   expires_at timestamp with time zone,
//   creator_id text not null
// );
// 
// [啟用 Row Level Security (RLS) 安全策略]
// 執行以下 SQL 以啟用 RLS 並設定對應的存取政策：
// 
// alter table public.cards enable row level security;
// 
// -- 政策 1: 任何人皆可讀取未過期的賀卡 (供壽星拆信)
// create policy "Anyone can read unexpired cards"
// on public.cards for select
// using (expires_at is null or expires_at > now());
// 
// -- 政策 2: 只有經 Clerk 驗證的用戶可以建立卡片
// create policy "Authenticated users can insert cards"
// on public.cards for insert
// with check (auth.jwt() ->> 'sub' = creator_id);
// 
// -- 政策 3: 只有卡片擁有者可以刪除卡片
// create policy "Users can delete their own cards"
// on public.cards for delete
// using (auth.jwt() ->> 'sub' = creator_id);
//
// [Clerk Dashboard 設定]
// 1. 前往 Clerk Dashboard > JWT Templates。
// 2. 點擊 New Template > 選擇 Supabase。
// 3. 在 Supabase 控制台 > Project Settings > API 複製 JWT Secret。
// 4. 回到 Clerk 的 Supabase 模板編輯頁，將 JWT Secret 貼入 "Signing key" 欄位中，然後儲存。
// 5. 這將允許 Clerk 自動簽發 Supabase 能驗證的安全性 JWT Token。
