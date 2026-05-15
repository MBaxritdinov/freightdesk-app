# FreightDesk

Accounting automation platform for Uzbek logistics companies working with US truck drivers and brokers.

## Stack

- **Backend:** Python / FastAPI / SQLAlchemy / PostgreSQL
- **Frontend:** React / Vite / Tailwind CSS
- **Auth:** JWT tokens

## Quick Start

### 1. PostgreSQL Setup (Windows)

1. Download and install PostgreSQL from https://www.postgresql.org/download/windows/
2. During install, set a password for the `postgres` user and remember it.
3. Open **pgAdmin** or **psql** and create the database:
   ```sql
   CREATE DATABASE freightdesk;
   ```
4. Optionally create a dedicated user:
   ```sql
   CREATE USER freightdesk_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE freightdesk TO freightdesk_user;
   ```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows CMD
# or: source venv/Scripts/activate   # Git Bash

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your actual database credentials:
#   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/freightdesk

# Run the server
uvicorn main:app --reload --port 8000
```

The backend will:
- Auto-create all database tables on startup
- Seed an admin user: `admin@freightdesk.io` / `admin123`
- Seed 8 brokers: 7 STAR, RXO, BBI, CAL, ALG, AST, MTC, Freeway

API docs available at: ${import.meta.env.VITE_API_URL || '${import.meta.env.VITE_API_URL || ''}'/docs

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173 and log in with `admin@freightdesk.io` / `admin123`.
