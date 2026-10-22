# 終極和弦伴奏公式：課程影片與學員中心 MVP

## 影片實際存放在哪裡？
- 影片本身**不存放**在 Portaly、GitHub、Vercel 或 Redis。
- MVP 可先上傳 **YouTube「不公開」**：取得 URL，貼入 staging 的 `/admin`「課程影片與講義管理」。
- 也支援 Vimeo URL。將來可評估 Vimeo 付費方案的指定網域嵌入限制，適合需較多影片分享控制的付費課程。
- 注意：YouTube 不公開影片可被持有連結的任何人觀看或轉傳；學員中心伺服器端阻擋未購買的課程頁面，**無法使 YouTube 影片本身成為 DRM 或防分享影片**。
- Portaly 僅處理結帳與購課後引導；付款自動開課尚未串接，暫採舊有人工發驗證碼流程。

## 現有資料維持不變
- 仍用 LINE LIFF 登入及 Vercel staging 的獨立 Upstash Redis。
- 經由 `/api/student/me` 判斷單元授權；新增 `/api/student/unit?unit=1` 與 `/api/student/lesson?id=u1-l01`，每次查詢都由後端重新驗證登入及單元購買資格，直接輸入網址不能繞過。
- 已上架影片播放器只在會員授權成功後回傳 YouTube/Vimeo embed URL；沒有授權不讀取資料庫中的媒體網址。
- 影片是第三方資源；即使學員頁面受保護，取得第三方播放網址的人仍可能分享。

## 課程單元與暫存位置
四單元的名稱固定為：基礎樂理／認識和弦／和弦變化／和弦應用。
目前每單元建立 **最多 8 個可編輯位置**：`u1-l01` 至 `u4-l08`。這些只是後台內容欄位，**並非已確認的正式 32 堂課或課名**。
- 新課程默認未上架，顯示「第 XX 課」；可以點開說明，但不會播放。
- 後台輸入正式課名、YouTube 或 Vimeo 連結、可選的文字說明及 Google Drive／Dropbox／Notion 講義網址。
- 勾選「上架」後，只對具有該單元購買權限的 LINE 學員顯示影片。
- 後續拿到真實 30 堂左右的教案／片名後，再調整正式課程清單數量及順序。避免目前捏造課名。

## 操作順序
1. 上傳 **一支**測試用影片至 YouTube Studio，設定「不公開」；注意不能設定為僅本人可看的私人影片，否則學員無法透過嵌入觀看。
2. 進入 `https://piano-line-bot-staging.vercel.app/admin`，登入管理員，找到「課程影片與講義管理」。
3. 選擇「單元 1」與「第 01 課」，按「讀取這堂課」。
4. 輸入正式課名及影片網址，先不勾選「上架」，按「儲存這堂課」。
5. 確認後，再勾選「上架」，儲存；由 iPhone LINE 官方帳號「我的課程」進入單元 1 → 第 01 課測試播放。
6. 用沒有單元 1 權限的另一個測試帳號驗證 `403`，不得把公開 YouTube URL 當成完整影音存取保護。

## 安全
- 只有持有 ADMIN_SECRET 的人可以修改課程內容；密鑰只存在管理頁面分頁變數，不儲存到 GitHub。
- Redis 儲存文字課名、影片與講義網址，不儲存影片本體。
- 媒體網址限制 YouTube/Vimeo；講義網址僅容許 HTTPS 的 Google Drive、Dropbox、Notion。
- 使用者每次打開單元與單堂課皆即時校驗簽署的 LINE Session Cookie 和 Redis 的會員權限。
- 不修改 LINE Messaging API Rich Menu、Portaly webhook、原有 Gemini bot 或正式專案。 
