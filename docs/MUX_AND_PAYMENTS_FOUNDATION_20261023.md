# 金流與 Mux 影音存放基礎建設（2026-10-23，僅 staging）

## 這次實際完成的程式與未完成的部分

### 影音：已開發，但尚待 Mux 帳號與簽署憑證
- 教師後台目前可輸入 YouTube／Vimeo 影片網址，或 `mux:signed:PLAYBACK_ID`。
- Mux 播放政策**必須是 Signed**；不要使用 Public 播放 ID，也不要把 Mux API Access Token 或簽署私鑰貼進影片欄位。
- `GET /api/student/playback?id=u1-l02` 先檢查 LINE 登入 session、當下單元購買權限、課程是否上架、影片提供商是不是 Mux，才簽發 2 小時的 RS256 JWT。
- Mux Player Web Component 由 `https://cdn.jsdelivr.net/npm/@mux/mux-player@3` 載入，並分別收到播放/縮圖/故事板短效 JWT。
- 沒有 Mux 憑證時 API **503** 而不是退回公開播放；原本 YouTube/Vimeo 測試影片維持原狀，不會被覆寫。
- Mux 金鑰存入**獨立 staging Vercel 專案 Production env**，由使用者自行在 Mux Dashboard 安全產生，不貼在聊天或 GitHub。
- 後端 env:
  - `MUX_SIGNED_PLAYBACK_ENABLED=enabled`
  - `MUX_SIGNING_KEY_ID` = Mux Dashboard Signing Key ID（這不是 API Token）
  - `MUX_SIGNING_PRIVATE_KEY_BASE64` = Mux RSA 私鑰 PEM 以 Base64 編碼後的值（不含換行）
- Mux 私鑰長度和格式符合 RSA 2048+ 時才簽署；3 種 aud = v/t/s。
- 驗證限制：2 小時內可被擷取的播放憑證仍能在有效期內分享，並不能防止螢幕錄影；可將來加 Mux Playback Restriction。
- iPhone LINE、iPad 與 Mac／Windows 尚待使用真實 Mux Signed 影片逐項驗證，請先上傳**一支**樣本影片確認。
- Mux 方案：免費方案最多 10 支，27 支需 Pay as you go；依 180 分鐘 Basic 1080p 算儲存 $0.54 美元／月，播放依當月實際觀看分鐘數。當前 Pay as you go 頁面標示每月 100,000 免費播放分鐘與 $20 使用抵扣額，但先以實際新帳號帳務為準。
- 參考：https://www.mux.com/docs/guides/secure-video-playback / https://www.mux.com/pricing 。

### 收款：正式付款尚未串接，也沒有付款成功開課
- `GET /api/checkout/quote?plan=course_full` 回傳**規劃價** NT$3,000，`checkoutEnabled=false`；入門與進階組價格仍是 null。
- `POST /api/checkout/draft` 和 `GET /api/checkout/draft?id=...` 只做測試訂單草稿；預設 `STAGING_ORDER_DRAFTS` 未設定／disabled，一律 503。
- 即使在獨立 staging 明確設為 `STAGING_ORDER_DRAFTS=enabled`，也只會建立 `status=draft` 的測試記錄：不能收款、不能把訂單改為 paid、不能發驗證碼／購課權限。要有 LINE session、同源 Origin、JSON Content-Type 和長度足夠的重試碼。
- 測試訂單有 1 小時每人最多 10 筆、伺服器固定價格、無客戶郵件及卡號、不可由前端傳入付款狀態。
- `lib/checkout-pricing.js` 提供未來處理支付通知所需的訂單／已驗證事件金額、幣別、訂單 ID 匹配規則，**本身不能驗證第三方簽名**，目前不會自動開課。
- 藍新 NewebPay 官網允許個人申請，但目前官網文字對個人戶使用完整 MPG API 的可用性仍不清楚；應等帳戶開通與客服確認。綠界全方位導轉 API 可作備案；站內付 2.0 需要特約賣家，不應拿一般個人戶當成可以直接使用。
- 沒有選定支付商家、API 商家身分及測試憑證前，不要啟用自動開通或公開購買按鈕。
- 正式上線前還需：正確驗證支付商的簽署通知；查詢官方訂單狀態；冪等處理重送；付款成功唯一一次開課；退款撤銷；訂單對帳；發票／稅務及取消退款條款。
- 參考：https://www.newebpay.com/website/Page/content/faq / https://developers.ecpay.com.tw/2860/ 。

## 操作順序
1. 先在 Mux 官網註冊並確認 Pay as you go 費率，使用獨立測試環境。
2. 在 Mux Dashboard 上傳一支測試影片（選 Signed playback policy），確認播放 ID。
3. 在 Mux Dashboard 建立 Signing Key。**不把私鑰或密鑰傳給 AI 或貼在對話**，也別截出含密鑰的畫面。
4. 將三項 `MUX_...` 變數寫到 staging Vercel 專案的「Production」環境後重新部署；絕不可填到 Gemini 正式專案。
5. 在既有 `/admin` 用未使用的測試課位（例如單元 1 第 02 課）輸入 `mux:signed:PLAYBACK_ID`；初次先不上架，驗證後再上架。
6. 測 iPhone LINE、iPad 和 Chrome/Safari 的速度／聲音／播放控制與單元 3 未購買資格的拒絕回應。
7. 金流先開立藍新個人帳號，取得正式可用付款功能、API 身分與手續費，評估綠界候選，再開啟**金流沙盒**進行下一階段實際交易整合。
