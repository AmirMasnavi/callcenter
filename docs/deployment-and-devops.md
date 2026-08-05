# Deployment & DevOps Guide

This document covers multi-container orchestration, environment configuration, separate hosting setup (e.g. Render), production hardening, and PostgreSQL database backup/recovery routines.

---

## 🐳 Containerized Deployment (Docker Compose)

The root [`docker-compose.yml`](../docker-compose.yml) orchestrates three core services:
1. `db`: PostgreSQL 16 database.
2. `api`: Spring Boot 4 Java 21 backend service.
3. `web`: Nginx web server hosting the built React SPA.

### Step-by-Step Deployment
```bash
# 1. Clone repository on server
git clone https://github.com/elmosanatearia/call-center.git
cd call-center

# 2. Configure environment variables
cp .env.example .env
nano .env # Replace default demo passwords

# 3. Build and launch containers
docker compose up -d --build

# 4. Check service status
docker compose ps
docker compose logs -f api
```

The web application is exposed on port `8088` (`http://your-server-ip:8088`).

---

## ⚙️ Environment Variables Reference

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
These are the variables the stack actually reads (see `docker-compose.yml` and
`services/api/src/main/resources/application.yml`).

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `APP_PORT` | `8088` | Host port the web/Nginx container is published on |
| `DB_URL` | `jdbc:postgresql://db:5432/callcenter` | JDBC URL used by the API |
| `DB_USER` | `callcenter` | PostgreSQL username (also seeds `POSTGRES_USER`) |
| `DB_PASSWORD` | *(Required)* | PostgreSQL password (also seeds `POSTGRES_PASSWORD`) |
| `ADMIN_USERNAME` | `admin` | Username of the bootstrapped admin account |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Initial password for the admin account |
| `ADMIN_NAME` | `مدیر سامانه` | Display name for the admin account |
| `DEMO_USERS_ENABLED` | `true` | Seed `operator`/`supervisor`/`manager` (set `false` in prod) |
| `DEMO_PASSWORD` | `Demo12345!` | Shared initial password for **all** demo accounts |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8088,http://localhost:5173` | Allowed browser origins (comma-separated) |
| `COOKIE_SECURE` | `false` | Set `true` if serving over HTTPS |

> [!WARNING]
> `CORS_ALLOWED_ORIGINS` must contain the exact origin the browser loads the SPA from,
> including scheme and port. If it doesn't, the API answers every login with 403
> `Invalid CORS request` while all containers still report healthy — and `curl` checks pass,
> because curl sends no `Origin` header. Change `APP_PORT` and you must change this too.

> [!NOTE]
> There is a single `DEMO_PASSWORD` for every demo account. Per-role variables such as
> `MANAGER_PASSWORD` or `OPERATOR_PASSWORD` are **not** read by the application. Likewise
> there is no `prod` Spring profile — configuration is driven entirely by these variables.

---

## 🌐 Separate Hosting Architecture (e.g. Render / Railway / Vercel)

If front-end and back-end are hosted independently:

### Back-end Deployment Configuration
- **Build Command:** `mvn -pl services/api clean package -DskipTests`
- **Start Command:** `java -jar services/api/target/callcenter-api-1.0.0.jar`
- **Environment Variables:**
  ```dotenv
  DB_URL=jdbc:postgresql://<db-host>:5432/callcenter
  DB_USER=callcenter
  DB_PASSWORD=<secure-password>
  CORS_ALLOWED_ORIGINS=https://asa-callcenter.onrender.com
  COOKIE_SECURE=true
  DEMO_USERS_ENABLED=false
  ```

### Front-end Deployment Configuration
- **Build Command:** `npm run build` (inside `apps/web`)
- **Output Directory:** `apps/web/dist`
- **Environment Variables:**
  ```dotenv
  VITE_API_BASE_URL=https://callcenter-api.onrender.com
  ```

---

## 💾 Database Backup & Disaster Recovery

### Automated PostgreSQL Backup
Create a daily cron job to run `pg_dump`:

```bash
#!/usr/bin/env bash
# backup_db.sh
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/callcenter"
mkdir -p "$BACKUP_DIR"

docker exec -t callcenter-db-1 pg_dump -U callcenter callcenter | gzip > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Keep last 30 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```

### Database Restore Procedure
To restore from a backup:
```bash
gunzip -c /var/backups/callcenter/db_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i callcenter-db-1 psql -U callcenter -d callcenter
```
