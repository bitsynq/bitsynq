# Bitsynq AI Workbook
> A guide for AI assistants helping with this project.
>
> **Core Principle: Document first, code later.**

## Workflow

### 1. Before Starting
1. Read `docs/SESSION.txt` for current status
2. Read this workbook for project conventions
3. Read `README.md` for architecture overview

### 2. Planning Phase
Before writing any code:

1. **Update SESSION.txt**
   - Document what you plan to do
   - List related files

2. **For new features, write a design doc first**
   ```
   docs/design/
   └── {feature-name}.md
   ```

### 3. Implementation Phase
- Follow existing code style
- Backend: TypeScript + Hono
- Frontend: Vue 3 + Vuetify + Composition API
- Database: Cloudflare D1 (SQLite)

### 4. After Completion
- Update `docs/SESSION.txt` with Next Steps
- Make separate commits:
  - docs: documentation changes
  - feat: new features
  - fix: bug fixes
  - refactor: code restructuring

---

## Project Structure

```
bitsynq/
├── worker/                 # Cloudflare Worker backend
│   ├── src/
│   │   ├── routes/         # API routes (Hono)
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth middleware
│   │   └── db/             # SQL Schema & Migrations
│   └── wrangler.toml       # Worker config
├── frontend/               # Vue 3 frontend
│   ├── src/
│   │   ├── views/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── stores/         # Pinia state
│   │   └── services/       # API wrapper
│   └── vite.config.ts
├── contracts/              # Solidity smart contracts
└── docs/                   # Documentation
    ├── SESSION.txt         # Development progress
    └── AI_WORKBOOK.md      # This file
```

---

## Common Tasks

### Adding an API Endpoint
1. Create/modify route in `worker/src/routes/`
2. Add types in `worker/src/types.ts`
3. Add API method in `frontend/src/services/api.ts`
4. Update API endpoints in `README.md`

### Adding Database Columns
1. Create migration SQL in `worker/src/db/`
2. Update `schema.sql` (complete schema record)
3. Update related routes and types

### Adding Frontend Pages
1. Create Vue component in `frontend/src/views/`
2. Add route in `frontend/src/router/index.ts`
3. Update navigation if needed

---

## Commit Convention

```
type(scope): short description

- docs: documentation
- feat: new feature
- fix: bug fix
- refactor: code restructuring
- chore: maintenance
```

Examples:
```
docs: add SESSION.txt and AI workbook
feat(anchor): add blockchain evidence anchoring
fix(meetings): handle null content_hash
```

---

## Key Reminders

1. **Document first, code later** - Update SESSION.txt before coding
2. **Separate commits** - Split docs and code into different commits
3. **Keep SESSION.txt updated** - Help the next AI know the status
4. **Type safety** - Avoid `any` in TypeScript
5. **Test endpoints** - Test any API changes

---

*This workbook is for AI assistants helping with Bitsynq development.*
