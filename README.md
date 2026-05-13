# 教會鋼琴手｜LINE Bot 部署教學

## 系統架構

```
學員下單 (Portaly)
    ↓
Portaly Webhook 通知
    ↓
Vercel 伺服器（免費）
    ↓ 自動產生驗證碼
    ↓ 用 LINE 推播給學員
    ↓
學員在 LINE 輸入驗證碼
    ↓
系統驗證 → 開通圖文選單
```

---

## 步驟一：部署到 Vercel

1. 去 [github.com](https://github.com) 建立免費帳號
2. 建立一個新的 Repository（點右上角 + → New repository）
3. 把這個資料夾裡的所有檔案上傳進去
4. 去 [vercel.com](https://vercel.com) 用 GitHub 帳號登入
5. 點「Add New Project」→ 選你剛建的 Repository → 點「Deploy」
6. 等待部署完成，你會拿到一個網址，例如：`https://piano-line-bot.vercel.app`

---

## 步驟二：建立 Vercel KV 資料庫

1. 在 Vercel 後台，點你的專案 → 點「Storage」
2. 點「Create Database」→ 選「KV」
3. 建立完後點「Connect to Project」連到你的專案
4. 環境變數會自動加入，不用手動設定

---

## 步驟三：設定環境變數

在 Vercel 後台 → 你的專案 → Settings → Environment Variables，加入以下：

| 變數名稱 | 值 |
|---------|---|
| `LINE_CHANNEL_SECRET` | 你的 Channel Secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | 你的 Channel Access Token |
| `ADMIN_SECRET` | 自己設一個後台密碼（例如：piano2024） |
| `PORTALY_WEBHOOK_SECRET` | 自己設一個（例如：portaly2024） |
| `RICH_MENU_STARTER` | 入門方案圖文選單 ID（下面說明怎麼取得） |
| `RICH_MENU_PLAN_A` | 方案A 圖文選單 ID |
| `RICH_MENU_PLAN_B` | 方案B 圖文選單 ID |

加完後點「Redeploy」讓設定生效。

---

## 步驟四：取得圖文選單 ID

1. 去 LINE Official Account Manager 登入
2. 點「圖文選單」→ 點你已建立的選單
3. 網址列裡會有一串 `richmenu-xxxxxxxxxx`，複製這段就是 ID
4. 每個方案如果用同一個選單，三個環境變數填一樣的值也沒關係

---

## 步驟五：設定 LINE Webhook URL

1. 去 [developers.line.biz](https://developers.line.biz) → 你的 Channel
2. 點「Messaging API」分頁
3. 找到「Webhook URL」→ 填入：
   ```
   https://你的vercel網址.vercel.app/api/webhook
   ```
4. 點「Verify」確認連線成功 ✅
5. 把「Use webhook」開啟

---

## 步驟六：設定 Portaly Webhook（自動推播用）

1. 登入 Portaly 後台
2. 找到 Webhook 設定（在商品或帳號設定裡）
3. 填入：
   ```
   https://你的vercel網址.vercel.app/api/portaly-webhook?secret=你設的PORTALY_WEBHOOK_SECRET
   ```
4. 在購買表單加一個自訂欄位，請學員填入 LINE User ID

> **如何讓學員知道自己的 LINE User ID？**
> 可以另外建一個簡單的 LINE Bot 讓他們加入後自動回覆 User ID，
> 或是用較簡單的方式：先跳過這個欄位，改用手動後台產生驗證碼。

---

## 步驟七：使用後台管理

打開瀏覽器，進入：
```
https://你的vercel網址.vercel.app/admin
```

輸入你設的 `ADMIN_SECRET` 密碼就能登入。

功能：
- 手動產生驗證碼（可選方案、填備註）
- 填入學員 LINE User ID 後自動推播
- 查看所有驗證碼狀態

---

## 學員使用流程

1. 學員購課 → 收到驗證碼（自動或老師手動傳）
2. 打開 LINE 官方帳號
3. 輸入 8 碼驗證碼（例如：ABCD1234）
4. 系統自動驗證 → 開通圖文選單 → 可以開始學習 🎹

---

## 常見問題

**Verify webhook 失敗？**
→ 確認環境變數都有設定，並重新 Redeploy

**學員說圖文選單沒有出現？**
→ 確認 RICH_MENU_XXX 的 ID 是否正確，圖文選單要先「發佈」才能用

**想測試自己的驗證碼流程？**
→ 在後台產生一個驗證碼，然後在 LINE 官方帳號傳給自己試試看
