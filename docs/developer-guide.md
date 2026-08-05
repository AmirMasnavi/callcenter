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

---

## 🧪 Testing Guidelines

### Back-end Unit & Integration Tests (JUnit 5 & Testcontainers)
To run back-end unit and integration tests:
```bash
mvn -pl services/api test
```
*Note: Testcontainers requires Docker to be running locally to spin up disposable PostgreSQL containers during integration tests.*

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
