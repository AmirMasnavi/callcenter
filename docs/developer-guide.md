# Developer Onboarding & Contribution Guide

Welcome to the Call Center Report System developer guide! This document provides instructions for setting up a local development workspace, building backend and frontend modules, and executing automated test suites.

---

## 🛠 Local Environment Setup

### 1. Requirements & Tools
- **Java Development Kit (JDK):** Version 21 (OpenJDK / Eclipse Temurin recommended).
- **Maven:** Version 3.9+.
- **Node.js & npm:** Node.js 22 LTS or newer.
- **PostgreSQL:** Version 15+ running locally on port `5432` (or via Docker).
- **IDE:** IntelliJ IDEA / VS Code with Java & React/TypeScript plugins.

---

## 🏃 Running the Back-end (`services/api`)

### 1. Database Connection
Ensure PostgreSQL is running locally and a database named `callcenter` exists:
```sql
CREATE DATABASE callcenter;
CREATE USER callcenter WITH PASSWORD 'callcenter';
GRANT ALL PRIVILEGES ON DATABASE callcenter TO callcenter;
```

### 2. Run Application
From the repository root directory:
```bash
mvn -pl services/api spring-boot:run
```

The Spring Boot application automatically applies Flyway migrations (`V1`, `V2`, `V3`) on startup.

- **Base API URL:** `http://localhost:8080`
- **Health Endpoint:** `http://localhost:8080/actuator/health`
- **OpenAPI / Swagger UI:** `http://localhost:8080/swagger-ui.html`

---

## 🏃 Running the Front-end (`apps/web`)

### 1. Install Dependencies
```bash
cd apps/web
npm install
```

### 2. Start Vite Dev Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`. Vite proxies API calls from `/api` to `http://localhost:8080`.

> ⚠️ The API's `CORS_ALLOWED_ORIGINS` must list the origin your browser actually loads the app
> from, or **every login returns 403 `Invalid CORS request`**. For the Vite dev server that is
> `http://localhost:5173`; for the Docker stack it is `http://localhost:8088` (`APP_PORT`).
> Testing with `curl` will not reveal this — curl sends no `Origin` header, so it succeeds
> while real browsers fail.

---

## 🧪 Testing Guidelines

### Back-end Unit Tests (JUnit 5)
To run back-end tests:
```bash
mvn -pl services/api -o clean test
```

> ⚠️ **Always include `clean`.** If IntelliJ has compiled the module, its Eclipse-compiler
> output in `target/` makes Maven fail with `Unresolved compilation problems` even though the
> source compiles fine. `clean` removes the stale classes and the suite passes.

*Note: Testcontainers is on the classpath for future PostgreSQL-backed integration tests, but
the current suite is pure unit tests and needs no Docker.*

### Front-end Unit & Component Tests (Vitest)
To run front-end test suites:
```bash
cd apps/web
npm run test
```

---

## 🏗 Building Production Distribution Bundles

### 1. Build Back-end Executable Jar
```bash
mvn -pl services/api clean package -DskipTests
```
Output artifact: `services/api/target/callcenter-api-1.0.0.jar`

### 2. Build Front-end Distribution Bundle
```bash
cd apps/web
npm run build
```
Output directory: `apps/web/dist`
