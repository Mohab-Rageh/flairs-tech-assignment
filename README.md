# Football Team Management System

A NestJS-based football team management system with player transfers, team management, and user authentication.

## Setup Instructions

### Prerequisites

- Node.js (v16 or later)
- PostgreSQL (v12 or later)
- npm or yarn

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd flairs-tech-assignment

# Install dependencies
npm install
```

### Step 2: Set Up Database

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE football_management;
   ```

   Or using command line:
   ```bash
   createdb football_management
   ```

2. Get your database connection string in the format:
   ```
   postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
   ```

### Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and update the following variables:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `PORT` - Server port (default: 3000)
   - `NODE_ENV` - Environment mode (development/production)
   - `ALLOWED_ORIGINS` - CORS allowed origins (for production)
   - `JWT_SECRET` - Secret key for JWT tokens
   - `JWT_EXPIRES_IN` - JWT token expiration time

### Step 4: Run Database Migrations

```bash
npm run prisma:migrate
```

This will create the database schema based on `prisma/schema.prisma`.

### Step 5: (Optional) Seed the Database

Populate the database with sample data:

```bash
npm run prisma:seed
```

### Step 6: Start the Application

**Development mode:**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Verification

Once the server is running, you should see:
```
Server now listening on port 3000
```

You can also open Prisma Studio to view your database:
```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` where you can browse your database.

## Time Report

The following is a detailed breakdown of time spent on each section of the project:

| Task | Time Spent |
|------|------------|
| Cloned and refactored NestJS app template (created 2 months ago) | 1 hour |
| Authentication module (unified register/login flow, JWT, password hashing) | 1.5 hours |
| Team Module (create a team after user registration) | 0.5 hour |
| Transfer Market module (filter, add/remove players, buy players) | 0.5 hour |
| **Total** | **3.5 hours** |
