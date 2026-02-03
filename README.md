# Bitsynq - 貢獻追蹤與 Token 發放系統

將 Zoom 會議貢獻轉化為可追蹤的價值，公平透明地發放 Token 獎勵。

## 功能特色

- 📤 **會議紀錄解析** - 上傳 Zoom AI 生成的會議摘要，自動解析參與者貢獻
- 📊 **貢獻追蹤** - 以比例記錄每個人的貢獻度，清晰透明
- 🪙 **Token 發放** - 根據貢獻比例自動計算並發放 Token 獎勵
- 👥 **專案管理** - 建立專案、管理成員、追蹤進度

## 技術架構

```
bitsynq/
├── worker/          # Cloudflare Worker API (TypeScript + Hono)
│   ├── src/
│   │   ├── routes/      # API 路由
│   │   ├── services/    # 業務邏輯 (會議解析、Token 計算)
│   │   ├── middleware/  # 認證中間件
│   │   └── db/          # D1 資料庫 Schema
│   └── wrangler.toml
├── frontend/        # Vue 3 + Vuetify SPA
│   ├── src/
│   │   ├── views/       # 頁面元件
│   │   ├── stores/      # Pinia 狀態管理
│   │   ├── services/    # API 封裝
│   │   └── plugins/     # Vuetify 配置
│   └── vite.config.ts
└── contracts/       # ERC-6909 智能合約 (可選)
```

## 快速開始

### 1. 安裝依賴

```bash
# 後端 Worker
cd worker
npm install

# 前端
cd ../frontend
npm install
```

### 2. 設定 Cloudflare D1 資料庫

```bash
cd worker

# 建立 D1 資料庫
wrangler d1 create bitsynq-db

# 將回傳的 database_id 更新到 wrangler.toml

# 執行資料庫遷移
wrangler d1 execute bitsynq-db --local --file=src/db/schema.sql
```

### 3. 啟動開發伺服器

```bash
# Terminal 1: 啟動後端
cd worker
npm run dev  # 預設 http://localhost:8787

# Terminal 2: 啟動前端
cd frontend
npm run dev  # 預設 http://localhost:5173
```

## API 端點

### 認證
- `POST /api/auth/register` - 註冊
- `POST /api/auth/login` - 登入

### 專案
- `GET /api/projects` - 列出專案
- `POST /api/projects` - 建立專案
- `GET /api/projects/:id` - 專案詳情

### 會議
- `POST /api/projects/:id/meetings` - 上傳會議紀錄
- `POST /api/projects/:id/meetings/:meetingId/process` - 處理會議並建立貢獻

### Token
- `POST /api/projects/:id/distributions/preview` - 預覽分配
- `POST /api/projects/:id/distribute` - 執行發放

## 會議紀錄格式

系統支援 Zoom AI 生成的 Meeting Summary 格式：

```
Meeting summary

Quick recap
...

Next steps
和融: Complete the token sender design...
胡舜元: Get Mohammad's contact info...

Summary
...
```

## 部署

### Cloudflare Pages (前端)

```bash
cd frontend
npm run build
# 上傳 dist/ 到 Cloudflare Pages
```

### Cloudflare Workers (後端)

```bash
cd worker
npm run deploy
```

## 文件 Documentation

詳細開發文件請參考 `docs/` 目錄：

- **[SESSION.txt](docs/SESSION.txt)** - 當前開發進度與下一步規劃
- **[AI_WORKBOOK.md](docs/AI_WORKBOOK.md)** - AI 助手工作手冊（先文件，後程式碼）

## License

MIT
