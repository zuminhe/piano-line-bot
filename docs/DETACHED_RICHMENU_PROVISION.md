# LINE 六格純測試版：建立「不綁定任何人」的 Rich Menu（審查草稿）

## 這一階段做什麼？
新增 `lib/detached-richmenu-provision.js` 與管理後台檔案選擇功能；只會在**明確啟用**時向 Messaging API 呼叫：

1. `GET /v2/bot/richmenu/list`：防重複檢查
2. `POST /v2/bot/richmenu/validate`：確認僅一個點擊區域的選單 JSON 符合規範
3. `POST /v2/bot/richmenu`：建立新的非預設、未綁定選單
4. `POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content`：上傳核准的 PNG
5. `GET /v2/bot/richmenu/{richMenuId}`：核對選單設定

**沒有** `/user/all`（全體預設）或 `/user/{userId}/richmenu/{richMenuId}`（個人綁定）操作，也沒有 unlink/delete。

## 嚴格限制
- `ADMIN_SECRET` 管理員認證通過，且 `RICH_MENU_PROVISION_MODE=enabled` 才開啟此新功能。
- `RICH_MENU_TEST_MODE=enabled`、有效且唯一的 `RICH_MENU_TEST_USER_ID`、指定的 `LINE_LIFF_ID=2009925919-tfNYEEmH`。
- 正確的 `LINE_CHANNEL_ACCESS_TOKEN` 必須由操作者自行在 Vercel **測試專案**的加密環境變數中設定；**切勿分享到對話或 GitHub**。
- 圖片必須是先前核准的原 PNG：`2500×1686`、`127044` bytes、SHA-256 `5f757ef5c8331e1604933891e9e2f2391a219025e5769c0c37f6018cca2b11fe`。錯誤圖片直接拒絕。
- 使用**獨立 staging Redis** 的永久建立意圖紀錄 `richmenu:test:provision:v1`（SET NX）；LINE 回覆不明時不自動重試、也不刪除任何舊選單。
- 一旦完成一次建立嘗試，後續會安全阻擋；不會再建立第二個相同的測試選單。
- 完成建立只代表取得 Rich Menu ID 和上傳圖片，**不會讓任何 LINE 好友看見這個測試選單**，除非以後另外將它綁定到指定好友。

## 目前不要實際啟用的原因
這是尚未部署的獨立 GitHub 審查分支。真正把 LINE Channel Access Token 加入測試部署以前，還需要：
1. 確認 Token 指向正確的 Messaging API Channel，並在使用者本人同意後啟用。
2. 審查累積的 feature branches 與既有 staging 部署的相容性。
3. 執行唯讀備份原有個人選單的真實查詢；`404` 的含義不確定時，不應進入個人選單綁定測試。
4. 審查恢復原有個人選單的操作程序與風險，明確分隔圖片建立和使用者切換。
5. 在 iPhone LINE App 驗證**單一指定測試帳號**的功能。

本分支未合併至 `main`，未部署至 Vercel，未使用任何正式 Channel Token，也未對 LINE 呼叫 API。原 Gemini webhook 與已排程的 LINE 官方帳號選單不變。

## 文件
- https://developers.line.biz/en/reference/messaging-api/#create-rich-menu
- https://developers.line.biz/en/reference/messaging-api/#validate-rich-menu-object
- https://developers.line.biz/en/reference/messaging-api/#upload-rich-menu-image
- https://developers.line.biz/en/docs/messaging-api/use-per-user-rich-menus/
