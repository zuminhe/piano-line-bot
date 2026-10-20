# 單一測試帳號用 LINE 圖文選單（尚未啟用）
此分支只準備可審查的「純測試版」定義，不連線 LINE、沒有建立或修改任何正式選單。

## 六格位置
版型：2500 × 1686 像素；上排三格、下排三格。只有左上角 A 有動作：
- A 我的課程 → `https://liff.line.me/2009925919-tfNYEEmH`
- B/C/D/E/F：**沒有 action 區域**，即使顯示測試字樣也不可點。
- `selected:false`，不設定任何預設圖文選單。

## 啟用前強制檢查
1. 由正式 Messaging API Channel 以 GET 方式確認「測試 LINE User ID」目前被綁定的 **個人選單 ID**。若 API 回傳 `404`，不得推定沒有個人選單（也可能是帳號不存在或尚未加好友）；標記為不確定並停止切換。需區分個人選單與全體預設選單；不要猜測或從 LINE Official Account Manager 畫面推算。
2. 將舊個人選單 ID 安全保存到獨立 staging 資料庫，避免遺失。**此動作目前尚未實作**。
3. 建立新的非預設 Rich Menu，並上傳專用圖片。**此動作目前尚未實作**。
4. 確認新選單只有左上角 action；檢查來源是本次建立的 ID，且 `RICH_MENU_TEST_MODE=enabled` 和 `RICH_MENU_TEST_USER_ID` 精確一致。再以單一帳號 API link。
5. 手動在 LINE App 檢查單一測試帳號的畫面與 LIFF 登入。其他好友不可受影響。
6. 還原前再次查詢該測試帳號目前選單是否等於本次建立的測試 ID；不是就停止，不覆寫不熟悉的變更。
7. 只有事前取得 `200` + 有效原個人選單 ID、並在獨立資料庫保存成功的帳號，才能進行本次試切換；還原時必須確認目前仍是我們的測試選單，再重新 link 原本 ID。無法確認或無原個人選單的帳號先不參與此輪實際試切換。不可刪除原選單。
8. 驗證還原後，關閉 `RICH_MENU_TEST_MODE`，移除 staging Access Token；測試選單等確認不被任何人使用後才刪除。

## 安全邊界
- 不修改 `https://piano-line-bot-omega.vercel.app/api/webhook`
- 不更改 LINE Official Account Manager 的「學員系統」「訪客介面」
- 不部署或合併到 `main`
- 尚未取得正式 LINE API Token，不能宣稱實際建立或還原選單成功
- 官方文件：`GET /v2/bot/user/{userId}/richmenu` 的 `404` 意義不唯一；本輪將它視為「不可安全操作」，而非 `null`。
- 此分支提供純邏輯快照與還原決策，尚未接上 LINE GET、快照資料庫存放、建立選單、上傳圖片或 API 還原動作。
- 不能僅依靠白名單就跳過「事前讀取／事後還原」檢查
