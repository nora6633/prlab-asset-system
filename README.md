# PRLab Asset System

[![DevSecOps Pipeline](https://github.com/nora6633/prlab-asset-system/actions/workflows/devsecops.yml/badge.svg)](https://github.com/nora6633/prlab-asset-system/actions/workflows/devsecops.yml)

實驗室資產管理系統：瀏覽資產、申請租借、管理員管理資產與授權使用者。
使用 Google OAuth 登入，後端簽發 JWT。

## Tech Stack

- **Frontend** — React (Vite) + TailwindCSS + React Query + @react-oauth/google
- **Backend** — FastAPI + SQLAlchemy + Alembic + python-jose + google-auth
- **Database** — PostgreSQL 16
- **Local Dev** — Docker Compose
- **Deployment** — Kubernetes（manifests 放在 `k8s/`）

## Project Structure

```
prlab-asset-system/
├── .github/workflows/  # CI: DevSecOps pipeline
├── frontend/           # React + Vite
├── backend/            # FastAPI
│   ├── routers/        # auth.py, assets.py, borrow.py, admin.py
│   ├── tests/          # pytest 測試（FastAPI TestClient + SQLite）
│   └── alembic/        # 資料庫 migration
├── k8s/                # Kubernetes manifests
├── scripts/            # 工具腳本（CSV 匯入等）
├── security/           # CVE 修補紀錄
├── docker-compose.yml
├── .env.example
└── README.md
```

## Permission Model

| Role | Permissions |
| --- | --- |
| 未登入 | 瀏覽 `GET /api/assets` 與 `GET /api/assets/:id` |
| Google 已登入 | 申請租借、查看自己的租借紀錄 |
| 在 `authorized_users` 表中 | 新增/修改/刪除資產、管理所有租借、新增授權使用者 |

第一位授權使用者需直接在 DB 寫入，例如：

```sql
INSERT INTO authorized_users (email, added_by, added_at)
VALUES ('you@example.com', 'bootstrap', NOW());
```

## Local Development (docker-compose)

```bash
cp .env.example .env
# （視需要修改 .env 內容）

docker compose up --build
```

啟動後：

- Frontend：<http://localhost:8081>
- Backend API：<http://localhost:8000/api/health>
- Postgres：`localhost:5432`（帳密見 `.env`）

Backend 啟動時會自動建立資料表（`Base.metadata.create_all`），不需手動 migration 即可開發。
正式環境請改用 Alembic：

```bash
cd backend
alembic revision --autogenerate -m "init"
alembic upgrade head
```

## Run Backend Without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # production deps
# 或：pip install -r requirements-dev.txt  # 同上 + pytest / httpx
export DATABASE_URL=postgresql://prlab:prlab@localhost:5432/prlab_assets
uvicorn main:app --reload
```

## Run Tests

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

4 個測試走 SQLite in-file，不需要起 Postgres，也不需要任何外部服務。

## Run Frontend Without Docker

```bash
cd frontend
cp .env.example .env  # 可在此填入 VITE_GOOGLE_CLIENT_ID
npm install
npm run dev    # http://localhost:5173 (proxy /api -> :8000)
```

## Import Assets from CSV

CSV header：`asset_no,name,alias,model,location,status,quantity,note`

```bash
# 連到目前 .env 指定的 DATABASE_URL
python scripts/import_assets.py scripts/sample_assets.csv

# 試跑（不寫入）
python scripts/import_assets.py scripts/sample_assets.csv --dry-run

# 已存在的 asset_no 改為更新而非跳過
python scripts/import_assets.py scripts/sample_assets.csv --update-existing
```

## Deploy to Kubernetes

1. 建立 namespace 與 Secret（**請先填入真實值**，不要把 `secrets.yaml` 的真實版本 commit）：
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```
2. 部署資料庫、後端、前端：
   ```bash
   kubectl apply -f k8s/postgres-statefulset.yaml
   kubectl apply -f k8s/backend-deployment.yaml
   kubectl apply -f k8s/frontend-deployment.yaml
   ```
3. 設定 Ingress（記得改 `host` 與 TLS issuer）：
   ```bash
   kubectl apply -f k8s/ingress.yaml
   ```

### Probes & Security

- Backend `readinessProbe` / `livenessProbe` → `GET /api/health`
- Frontend `readinessProbe` / `livenessProbe` → `GET /health`（由 nginx 直接回 200）
- Postgres probe → `pg_isready`
- 所有密碼/密鑰透過 `prlab-secrets` 注入，**不寫在 Deployment yaml 內**

## API Reference

```
POST   /api/auth/google              # 用 Google ID token 換 JWT

GET    /api/assets                   # public
GET    /api/assets/:id               # public
POST   /api/assets                   # authorized only
PUT    /api/assets/:id               # authorized only
DELETE /api/assets/:id               # authorized only

GET    /api/borrow                   # authorized: all / 一般: 自己
POST   /api/borrow                   # logged in
PUT    /api/borrow/:id/return        # authorized only

GET    /api/admin/authorized-users
POST   /api/admin/authorized-users
DELETE /api/admin/authorized-users/:id

GET    /api/health                   # readiness/liveness 用
```

## DevSecOps Pipeline

每次 push 到 `main` 會觸發 `.github/workflows/devsecops.yml`，包含七個並行 job：

| Stage | Job | Tool |
| --- | --- | --- |
| Install + Test | `test-backend` | pytest (FastAPI TestClient + SQLite) |
| Build / Package | `build-frontend` | Vite build → 上傳 dist artifact |
| Dependency scan | `dep-scan-python` | pip-audit（PyPI Advisory DB） |
| Dependency scan | `dep-scan-npm` | npm audit（GHSA） |
| Secret scan | `secret-scan` | gitleaks |
| Static code scan | `sast-bandit` | bandit (Python SAST) |
| SAST + SBOM | `shiftleft-scan` | ShiftLeft Scan（含 SBOM 產出） |

歷史的 CVE 修補紀錄（vite 5→8、python-jose、starlette 等套件升版）整理在 [`security/CVE-REPORT.md`](security/CVE-REPORT.md)。

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy 連線字串 |
| `JWT_SECRET` | 簽發 JWT 的密鑰 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID（後端驗 token、前端登入） |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret（目前未使用 client-secret flow，但保留） |
| `APP_ENV` | `development` / `production`，影響 CORS 等行為 |
| `VITE_API_BASE_URL` | 前端打 API 的位址（預設 `/api`） |
| `VITE_GOOGLE_CLIENT_ID` | 前端 `<GoogleLogin>` 用的 client ID |

## Demo
- Google OAuth 登入/資產列表<img width="1170" height="322" alt="image" src="https://github.com/user-attachments/assets/04df7417-1bbd-45b6-9ddc-8f2b52a63ab7" />
- 申請租借<img width="1122" height="412" alt="image" src="https://github.com/user-attachments/assets/05faaebe-5f40-4e24-bf57-097edc8d95a1" />
- Admin 視角<img width="1153" height="743" alt="image" src="https://github.com/user-attachments/assets/87fef74a-6311-4c6a-8ca3-c8c89277296d" />


