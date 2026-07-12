# TransitOps — Smart Transport Operations Platform

TransitOps is a modern, full-stack, enterprise-ready transport management system designed to optimize fleet operations, driver safety compliance, dispatch coordination, maintenance tracking, and financial analytics. It is equipped with role-based access control (RBAC), database seeding, and containerized running configurations.

---

## Architecture Overview

* **Frontend (FE):** React + TypeScript + Vite styled with customized Vanilla CSS + tailwind utilities. Package management via `pnpm` (or `npm`).
* **Backend (BE):** FastAPI + SQLAlchemy (Async ORM) + Celery Task Queue + PostgreSQL + Redis. Package/environment management via `uv`.

---

## 1. Role-Based Access Control (RBAC) & Testing Credentials

TransitOps supports multi-role users. The interface renders views dynamically based on the logged-in user's roles:

| Role | Accessible Pages | Permissions / Write Privileges |
|------|------------------|--------------------------------|
| **Admin** | Dashboard, Fleet, Drivers, Trips, Maintenance, Fuel & Expenses, Analytics, User Management | Full Create/Edit/Delete access on all modules. |
| **Fleet Manager** | Dashboard, Fleet, Maintenance, Trips (View Only), Fuel & Expenses (View Only), Analytics | Create/Edit/Retire vehicles; create/update/cancel/complete maintenance logs. |
| **Safety Officer** | Dashboard, Drivers, Trips (View Only) | Create/Edit/Suspend/Activate driver safety profiles. |
| **Dispatcher** | Dashboard, Fleet (View Only), Drivers (View Only), Trips | Create, Dispatch, Complete, or Cancel trips. |
| **Financial Analyst** | Dashboard, Fuel & Expenses, Analytics, Fleet (View Only), Maintenance (View Only) | Log fuel entries, create/delete expenses, view reports. |

### Seeding Accounts
All seed accounts share the same password: **`password123`**

* **Admin:** `admin@transitops.com`
* **Fleet Manager:** `fleet@transitops.com`
* **Safety Officer:** `safety@transitops.com`
* **Dispatcher:** `dispatcher@transitops.com`
* **Financial Analyst:** `finance@transitops.com`

---

## 2. Backend (BE) Setup

### Option A: Running with Docker (Recommended)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Start the containers (FastAPI, Celery, PostgreSQL, Redis):
   ```bash
   docker compose up -d --build
   ```
4. Verify endpoints:
   * **FastAPI Server:** [http://localhost:8000](http://localhost:8000)
   * **API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

### Option B: Running Locally

1. Ensure Python 3.10+ and the `uv` tool are installed. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```
3. Sync dependencies and create virtual environment:
   ```bash
   uv sync
   ```
4. Start the FastAPI development server:
   ```bash
   uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
5. In another terminal tab, start the Celery task runner:
   ```bash
   uv run celery -A app.core.celery_app worker --loglevel=info
   ```

---

## 3. Database Seeding

Once the database containers or local services are up and running, you need to populate them with the default roles, user accounts, vehicles, drivers, trips, fuel entries, and maintenance logs:

* **If running in Docker Compose:**
  ```bash
  cd backend
  docker compose exec web python seed_dummy_data.py
  ```

* **If running Locally:**
  ```bash
  cd backend
  uv run seed_dummy_data.py
  ```

---

## 4. Frontend (FE) Setup

### Option A: Running with `pnpm` (Recommended)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the packages:
   ```bash
   pnpm install
   ```
3. Run the development server:
   ```bash
   pnpm run dev
   ```

### Option B: Running with `npm`

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

The web client will be available at: **[http://localhost:5173](http://localhost:5173)**.

---

## 5. Running the Test Suites

To execute the Pytest backend suites (unit and integration tests):

* **Inside Docker:**
  ```bash
  cd backend
  docker compose exec web pytest
  ```

* **Locally:**
  ```bash
  cd backend
  uv run pytest
  ```
