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
| `POSTGRES_DB` | `callcenter` | PostgreSQL database name |
| `POSTGRES_USER` | `callcenter` | PostgreSQL connection username |
| `POSTGRES_PASSWORD` | *(Required)* | PostgreSQL connection password |
| `SPRING_PROFILES_ACTIVE` | `prod` | Spring active profile |
| `DEMO_USERS_ENABLED` | `true` | Seed initial demo accounts (Set `false` in prod) |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Initial password for `admin` account |
| `MANAGER_PASSWORD` | `Demo12345!` | Initial password for `manager` account |
| `SUPERVISOR_PASSWORD` | `Demo12345!` | Initial password for `supervisor` account |
| `OPERATOR_PASSWORD` | `Demo12345!` | Initial password for `operator` account |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8088` | Allowed CORS origins (comma-separated) |
| `COOKIE_SECURE` | `false` | Set `true` if serving over HTTPS |

---

## 🌐 Separate Hosting Architecture (e.g. Render / Railway / Vercel)

If front-end and back-end are hosted independently:

### Back-end Deployment Configuration
- **Build Command:** `mvn -pl services/api clean package -DskipTests`
- **Start Command:** `java -jar services/api/target/callcenter-api-1.0.0.jar`
- **Environment Variables:**
  ```dotenv
  DATABASE_URL=jdbc:postgresql://<db-host>:5432/callcenter
  DATABASE_USERNAME=callcenter
  DATABASE_PASSWORD=<secure-password>
  CORS_ALLOWED_ORIGINS=https://asa-callcenter.onrender.com
  COOKIE_SECURE=true
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
