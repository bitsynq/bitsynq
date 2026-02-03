# Bitsynq AI Workbook
> 這是 AI 助手的工作手冊，說明如何協助這個專案。
>
> **重要原則：先寫文件，再寫程式碼。**

## 工作流程

### 1. 開始任務前
1. 閱讀 `docs/SESSION.txt` 了解當前狀態
2. 閱讀此工作手冊了解專案慣例
3. 閱讀 `README.md` 了解專案架構

### 2. 規劃階段 (Planning)
在動手寫程式碼之前：

1. **更新 SESSION.txt**
   - 記錄你要做什麼
   - 列出相關檔案

2. **如果是新功能，先寫設計文件**
   ```
   docs/design/
   └── {feature-name}.md
   ```

### 3. 實作階段 (Implementation)
- 遵循現有程式碼風格
- 後端：TypeScript + Hono
- 前端：Vue 3 + Vuetify + Composition API
- 資料庫：Cloudflare D1 (SQLite)

### 4. 完成後
- 更新 `docs/SESSION.txt` 的 Next Steps
- 提交變更時分開 commit：
  - docs: 文件變更
  - feat: 新功能
  - fix: 修復
  - refactor: 重構

---

## 專案結構速查

```
bitsynq/
├── worker/                 # Cloudflare Worker 後端
│   ├── src/
│   │   ├── routes/         # API 路由 (Hono)
│   │   ├── services/       # 業務邏輯
│   │   ├── middleware/     # 認證等中間件
│   │   └── db/             # SQL Schema & Migrations
│   └── wrangler.toml       # Worker 設定
├── frontend/               # Vue 3 前端
│   ├── src/
│   │   ├── views/          # 頁面元件
│   │   ├── components/     # 可重用元件
│   │   ├── stores/         # Pinia 狀態
│   │   └── services/       # API 封裝
│   └── vite.config.ts
├── contracts/              # Solidity 智能合約
└── docs/                   # 文件區
    ├── SESSION.txt         # 開發進度追蹤
    └── AI_WORKBOOK.md      # 本文件
```

---

## 常用任務

### 新增 API Endpoint
1. 在 `worker/src/routes/` 建立或修改路由
2. 在 `worker/src/types.ts` 新增型別
3. 在 `frontend/src/services/api.ts` 新增對應方法
4. 更新 `README.md` 的 API 端點列表

### 新增資料庫欄位
1. 在 `worker/src/db/` 新增 migration SQL
2. 更新 `schema.sql` (完整 schema 記錄)
3. 更新相關 routes 和 types

### 新增前端頁面
1. 在 `frontend/src/views/` 建立 Vue 元件
2. 在 `frontend/src/router/index.ts` 新增路由
3. 更新導航 (如適用)

---

## Commit 慣例

```
類型(範圍): 簡短描述

- docs: 文件
- feat: 新功能
- fix: 修復
- refactor: 重構
- chore: 雜項
```

範例：
```
docs: add SESSION.txt and AI workbook
feat(anchor): add blockchain evidence anchoring
fix(meetings): handle null content_hash
```

---

## 重要提醒

1. **先文件後程式碼** - 在 SESSION.txt 記錄後再動手
2. **分開 commit** - 文件和程式分開提交
3. **保持 SESSION.txt 更新** - 讓下一個 AI 知道進度
4. **遵循型別安全** - TypeScript 不要用 any
5. **測試路徑** - 任何 API 變更要測試

---

*This workbook is for AI assistants helping with Bitsynq development.*
