# 終極和弦伴奏公式｜會員系統整合路線圖

## 已在此開發分支實作（尚未部署／尚未端對端驗收）
- GitHub 依權益分類：單元一至四、陪練訂閱；可累加、多筆撤銷、到期時計算權限。
- 以 LINE userId 為暫時的會員鍵，驗證碼綁定完成後儲存權益。
- 一次性 8 碼安全隨機碼，七天自動失效、原子核銷、基本輸入速率限制。
- LINE Webhook 使用 raw body 驗簽，Rich Menu 更新失敗會提示學員並保留待重試。
- 手動管理員介面：核對 Portaly 付款後發碼、查詢學員、補開、撤銷、同步選單。
- Portaly 未驗證事件暫時回應 503，不再信任用戶任填欄位自動開通。

## 尚未實作、不可當成上線能力
1. **Portaly 自動付款/退款開通**：先確認官方提供的實際 Webhook 簽名與事件欄位；驗證簽章、支付狀態、product_id 對照、事件去重及退款撤權，再啟用。
2. **電腦版會員登入**：已在開發分支新增 LINE Login OAuth+PKCE、state/nonce、伺服器 ID Token 驗證、簽章 HttpOnly Cookie 和學生中心權益 API；仍須配置 LINE 回呼網址與實際 Mac/Windows 登入測試。不可只靠 URL 或前端 userId 決定權限。
3. **LIFF**：既有 LIFF ID 為 `2009925919-c3NPUPtI`，原 Endpoint 指向 Portaly Students 頁，且已啟用 profile/openid；開發分支已加入 LIFF SDK/ID token 後台核對。仍須有獨立測試網址、設定 LINE_LIFF_ID、**經核對後再更改 Endpoint**，測試 LINE 內與外部瀏覽器的不同登入行為。不要現在修改正式 LIFF。
4. **影片防轉傳**：後端登入+權限判定，使用可限制嵌入來源或簽時效播放 token 的合適影片供應商。Rich Menu 不會保護 YouTube 不公開影片。
5. **到期主動同步**：新增定期任務或事件，訂閱到期時自動切回非訂閱圖文選單；會員 API 即時判斷到期不需要依賴這個任務。
6. **訂閱帳務**：待符合 Portaly 收款功能的真實交易事件確認後，新增取消／退款／續訂時間戳，訂閱批改次數及用量限制。
7. **身份及資料安全**：LINE userId 在不同 Provider 之間可能不同；確認 Messaging API/LINE Login/LIFF 的 Channel 使用一致的 Provider。強化登入管理員身份、多因素、防重放、審計日誌、Redis 備份、資料保留政策、台灣個資告知。
8. **實際測試**：兩名測試學員/兩組 LINE 帳號，一份前兩單元，一份完整課程，測試訂閱到期、撤權、同碼重放、Mac、iPhone。

## 正課第一波發行
- IG → Portaly 購買 → 老師核對訂單 → 手動發送一次性驗證碼 → 學員 LINE 綁定 → 專屬圖文選單。
- 第一階段影片暫沿用已確認有權限控制的交付方式；如果用 YouTube 不公開，清楚承認連結可分享，不能以 LINE 選單假裝有防盜版。
- 未完成會員中心之前，請不要將按鈕直接連到可被任意轉傳的永久共享網址。

## 必要環境變數（只存在 Vercel，不提交進 GitHub）
- LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN
- UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN
- ADMIN_SECRET：至少 24 字元的高強度隨機密鑰
- RICH_MENU_GUEST、RICH_MENU_MEMBER、RICH_MENU_COACHING（選用；必須是 Messaging API 建立的 Rich Menu ID）
- 目前 **不需要** PORTALY_WEBHOOK_SECRET；付款自動串接暫停。

## 不要直接部署
這個分支是待審核版本。尤其舊的後台與驗證碼資料結構已更換，部署之前必須備份原本 Redis、驗證選單及測試。不要直接覆蓋既有正式營運資料。

## 本次新增：學生中心測試版本（尚未部署）
- `/student`：登入入口、本人單元 1–4 開通狀態、陪練資格；僅顯示資格，不提供未完成保護的影片。
- `/api/auth/line/start`：Mac/一般瀏覽器 OAuth 登入、PKCE、state、nonce。
- `/api/auth/line/callback`：檢查 LINE ID Token 並設定 Secure/HttpOnly/SameSite=Lax 登入 Cookie。
- `/api/auth/line/liff`：LIFF ID token 由伺服器驗證，不信任前端直接傳入 userId。
- `/api/student/me`：登入後查自己的權限；不返回所有訂單及驗證碼。
- `/api/auth/logout`：清除本站工作階段；不會登出 LINE App 本身。

### 測試 Vercel 環境新增變數（正式站暫不改）
- `STUDENT_BASE_URL`：測試站固定 HTTPS origin，例如 `https://staging.example.com/`。必須與瀏覽器實際 origin 一致。
- `SESSION_SECRET`：獨立高強度隨機密鑰，至少 32 字元。不得放入 GitHub。
- `LINE_LOGIN_CHANNEL_ID`：既有 LINE Login Channel ID，可從 LINE Developers 查看。
- `LINE_LOGIN_CHANNEL_SECRET`：對應 LINE Login Channel Secret，僅保存在 Vercel 環境變數。
- `LINE_LIFF_ID`：既有 LIFF ID（只有 LIFF Endpoint 改為新站後，LIFF 登入才可實際驗收）。
- `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`：測試期應使用**獨立測試資料庫**；不要與正式學生混用。

### 待手動設定與端對端驗收
1. 建立與正式環境隔離的 Vercel Preview／Staging 部署。
2. 在 LINE Login Channel 設定測試站確切 Callback URL：`https://<staging-domain>/api/auth/line/callback`，並確保 Channel 測試者有適當權限。
3. 保持既有 LIFF Endpoint 不動，先測試 Mac LINE Login 與權限 API；正式換 Endpoint 前另外檢查 LIFF 的網域要求。
4. 使用兩個測試學員及測試 Redis 驗證不同購買權限、無權限拒絕、到期、撤銷。
5. 驗收成功後，才決定 LIFF Endpoint 與既有 Vercel 正式部署如何安全切換。
