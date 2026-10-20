# 終極和弦伴奏公式｜LINE 六格圖文選單純測試版

## 已完成（僅離線製圖＋測試程式）
- 檔名：`piano_richmenu_six_cell_test_2500x1686.png`
- PNG：2500 × 1686 px，127044 bytes（約 124.1 KiB），SHA-256：`5f757ef5c8331e1604933891e9e2f2391a219025e5769c0c37f6018cca2b11fe`
- 由 `scripts/generate-richmenu-test-image.py` 產出，需要 Pillow + Noto Sans CJK（只引用已安裝字型，**不在專案內散佈字型檔**）。
- 本分支 GitHub 儲存可重製圖片的原始程式、圖片規格 manifest 與 Rich Menu JSON；**不含已上傳至 LINE 的 Rich Menu ID，也不包含 PNG 二進位圖檔**。交付 PNG 在本次 ChatGPT 對話的下載附件。
- 待驗證對照：`assets/richmenu-six-cell-test-definition.json` = `lib/rich-menu-test.js` 的物件。

## 六格對應與唯一有效連結
圖面座標原點 (0,0) 為左上角。寬 2500、高 1686；水平切線 y=843，垂直切線 x=833、x=1666。

| 區域 | x 範圍 | y 範圍 | 顯示文字 | 動作 |
| --- | --- | --- | --- | --- |
| A | 0–832 | 0–842 | 我的課程 | 唯一可點；`https://liff.line.me/2009925919-tfNYEEmH` |
| B | 833–1665 | 0–842 | 課程講義 | 無 |
| C | 1666–2499 | 0–842 | 作業上傳 | 無 |
| D | 0–832 | 843–1685 | 我要提問 | 無 |
| E | 833–1665 | 843–1685 | 推薦好友 | 無 |
| F | 1666–2499 | 843–1685 | 學員服務 | 無 |

LINE rich menu `areas` 陣列只有 A 一個物件，`bounds={x:0,y:0,width:833,height:843}`。`selected:false`，且不建立／切換全體好友的預設選單。

## 重要的真正上線前確認
1. **這個分支未合併、未部署，沒有使用正式 LINE Token、沒有建立 LINE Rich Menu，也沒有綁定任何真人帳號。**
2. 必須先由使用者確認這張圖片的版面與文字。
3. 建立專用的非預設 Rich Menu 之前，先走 `Validate rich menu object` 規格驗證；建立後會取得新的 `richmenu-...` ID，不能手填猜測。
4. 圖片透過 `POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content` 上傳，驗證上傳成功且有圖片。LINE 只能對一個 Rich Menu ID 上傳一次圖片，若要更換圖片需建立新的 Rich Menu。
5. **在綁定給單一測試 LINE 帳號前**，必須安全讀取且持久儲存原個人選單 ID；任何不確定（例如 LINE 404）則停止，不能用「目前看得到選單」來推定個人 Rich Menu ID。
6. 綁定時只能操作明確白名單帳號，禁止全體預設 `/user/all`，並必須有完整還原／異常安全機制。
7. LINE rich menu 無法在 macOS／Windows LINE 桌面版顯示，請用 iPhone LINE App 驗證畫面。

## 規格來源
- https://developers.line.biz/en/reference/messaging-api/#upload-rich-menu-image
- https://developers.line.biz/en/docs/messaging-api/using-rich-menus/
- https://developers.line.biz/en/docs/messaging-api/use-per-user-rich-menus/

所有正式權限／原有 Gemini 機器人與 webhook 保持不變。本次純測試版只準備圖片與 JSON 規格。
