# Deployment & Operations Guide
## Common Ground — Café E-Commerce & Order Management Platform

---

## 1. Deployment Architecture

The Common Ground platform is a unified Node.js + Express + Socket.IO application that serves:
1. **Static Frontend Entry Points** (`index.html`, `menu.html`, `product.html`, `checkout.html`, `tracking.html`, `orders.html`, `signin.html`, `barista.html`, `admin.html`) and modular ES6/CSS assets.
2. **RESTful API** (`/api/*`) and **Socket.IO WebSocket Server** (`/socket.io`).
3. **PostgreSQL Relational Database** (connects via `DATABASE_URL` to any managed PostgreSQL 15/16 provider such as Neon, Supabase, Railway, or Render PostgreSQL; automatically falls back to persistent embedded PostgreSQL 16 via `@electric-sql/pglite` when `DATABASE_URL` is omitted in local development).

---

## 2. Environment Variables

Copy [.env.example](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/.env.example) to `.env` and configure the following variables for production:

| Variable | Required in Prod | Default (Local Dev) | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `8090` | HTTP port for Express & Socket.IO server |
| `NODE_ENV` | Yes | `development` | Set to `production` in cloud deployments |
| `DATABASE_URL` | Yes (Cloud DB) | *(Embedded PGlite `./.pgdata`)* | Full PostgreSQL connection URI (`postgresql://user:pass@host:5432/dbname?sslmode=require`) |
| `DATABASE_SSL` | Optional | `false` | Set to `true` when connecting to managed cloud PostgreSQL requiring TLS |
| `JWT_SECRET` | **Yes (Critical)** | *(Dev fallback key)* | 64-byte cryptographic secret used to sign staff bearer tokens |
| `CORS_ORIGIN` | Yes | `*` | Allowed frontend origin (e.g., `https://commonground.coffee`) |
| `TELEGRAM_BOT_TOKEN` | Optional | *(Empty — disabled)* | Telegram Bot token from `@BotFather` for instant barista order alerts |
| `TELEGRAM_CHAT_ID` | Optional | *(Empty — disabled)* | Target Telegram channel/group chat ID for order notifications |

> **Important Note on External Cloud Credentials**:
> Real cloud deployment to external providers requires your personal account credentials (`DATABASE_URL` from Neon/Supabase/Render, production `JWT_SECRET`, and optional `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`). Never commit `.env` files containing live production secrets to Git.

---

## 3. Database Migration, Seeding & Backup Procedures

### 3.1 Applying Schema Migrations
Runs [server/db/migrations/001_initial_schema.sql](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/server/db/migrations/001_initial_schema.sql) idempotently to create all 20 tables and indexes:
```bash
npm run db:migrate
```

### 3.2 Seeding the 18-Product EGP Catalog & Default Staff Accounts
Populates the 5 categories, 18 Egyptian Pound (`EGP`) products, customization groups/options, inventory stock levels, coupons (`WELCOME10`, `MORNING25`, `FREEDELIVERY`), staff accounts, and initial live orders:
```bash
npm run db:seed
```

### 3.3 Production PostgreSQL Backup & Restore
When connected to an external managed PostgreSQL database via `DATABASE_URL`:
```bash
# Create compressed custom-format backup
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="backup_$(date +%Y%m%d_%H%M%S).dump"

# Restore from backup
pg_restore --clean --no-owner --dbname="$DATABASE_URL" backup_YYYYMMDD_HHMMSS.dump
```

---

## 4. Cloud Deployment Instructions (Render / Railway / Fly.io)

Because the platform uses **Socket.IO** for real-time order queue updates between customers, baristas, and administrators, deploying the Node.js server to a persistent container host (such as **Render Web Service**, **Railway**, or **Fly.io**) is recommended:

1. **Connect GitHub Repository**:
   - Link `https://github.com/Khalid2907/Caf-E-Commerce-Order-Management-Platform.git` (`main` branch).
2. **Configure Build & Start Commands**:
   - **Build Command**: `npm install && npm run db:seed`
   - **Start Command**: `npm start`
3. **Configure Health Check**:
   - **Health Check Path**: `/api/health`
   - Expected response (`200 OK`):
     ```json
     {
       "success": true,
       "data": {
         "status": "ok",
         "database": "connected",
         "productsCount": 18,
         "currency": "EGP"
       }
     }
     ```
