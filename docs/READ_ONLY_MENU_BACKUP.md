# LINE 原選單備份：唯讀安全準備（尚未啟用）

目前已有 `lib/line-menu-read.js` 唯讀 LINE GET 適配器、`lib/menu-backup-service.js` 備份流程，以及需要 `ADMIN_SECRET` 驗證的管理員 `backup_personal_menu` 入口。尚未部署，尚未呼叫真實 LINE API，也沒有修改任何圖文選單。

- 獨立開關 `RICH_MENU_BACKUP_TOOLS=enabled` 才允許呼叫。
- 同時需要既有的 `RICH_MENU_TEST_MODE=enabled` 與完全一致的單一 `RICH_MENU_TEST_USER_ID`。
- 先確認獨立資料庫不存在原選單快照，再查詢個人選單。
- 查詢回傳 `200` 且有合法 `richMenuId` 才可產生快照；`404` 被視為含義不明而拒絕。
- 透過資料庫 `SET ... NX` 永不覆寫原備份。
- 此步驟**不包含**建立圖文選單、上傳圖片、切換、還原或刪除。

## 接下來仍需建置與審查
1. **已實作、尚未部署**：唯讀 LINE 個人選單 GET 適配器與經 ADMIN_SECRET 保護的管理員入口。
2. **已實作初步版本**：使用 Upstash Redis SET NX 與讀回核對；正式使用前仍應補強稽核和一致性。
3. 測試選單建立、圖片上傳及確認，再核對目前綁定是否仍等於備份。
4. 確定性恢復流程，含因其他人修改選單而拒絕覆寫的處理。
5. 模擬 LINE API 失敗、超時、並行修改與權限限制；人工審查通過才接上正式 LINE Token。

**目前不要把此分支部署到 Vercel，也不要新增正式 Messaging API Access Token 或開啟備份工具開關。** 本次新增的後台操作只查詢、備份；選單建立與還原 API 尚未實作。
