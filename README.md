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

## API Endpoints

All endpoints require JWT authentication (except `/auth/authenticate`). Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Authentication

#### POST /auth/authenticate
Unified endpoint for user registration and login. If the user doesn't exist, they will be registered. If they exist, they will be logged in.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Registration):**
```json
{
  "message": "User registered successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  }
}
```

**Response (Login):**
```json
{
  "message": "User authenticated successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  }
}
```

### Teams

#### GET /teams/my-team
Get the authenticated user's team with all players.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": "team-uuid",
  "name": "user",
  "budget": "5000000",
  "userId": "user-uuid",
  "createdAt": "2025-12-17T...",
  "updatedAt": "2025-12-17T...",
  "players": [
    {
      "id": "player-uuid",
      "name": "goalkeeper-1",
      "position": "GOALKEEPER",
      "value": "150000",
      "teamId": "team-uuid",
      "createdAt": "2025-12-17T...",
      "updatedAt": "2025-12-17T..."
    },
    ...
  ],
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

### Transfer Market

#### GET /transfers
Get all available transfers with optional filters.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters (all optional):**
- `teamName` - Filter by team name (case-insensitive)
- `playerName` - Filter by player name (case-insensitive)
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `page` - Page number (default: 1, minimum: 1)
- `limit` - Number of items per page (default: 50, minimum: 1, maximum: 100)

**Example Request:**
```
GET /transfers?teamName=john&minPrice=100000&maxPrice=500000&page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "transfer-uuid",
      "playerId": "player-uuid",
      "teamId": "team-uuid",
      "price": "200000",
      "status": "PENDING",
      "createdAt": "2025-12-17T...",
      "updatedAt": "2025-12-17T...",
      "player": {
        "id": "player-uuid",
        "name": "forward-1",
        "position": "FORWARD",
        "value": "180000",
        "teamId": "team-uuid"
      },
      "team": {
        "id": "team-uuid",
        "name": "john",
        "budget": "5000000",
        "user": {
          "id": "user-uuid",
          "email": "john@example.com"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### POST /transfers
Add a player to the transfer list with an asking price.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "playerId": "player-uuid",
  "askingPrice": 200000
}
```

**Response:**
```json
{
  "id": "transfer-uuid",
  "playerId": "player-uuid",
  "teamId": "team-uuid",
  "price": "200000",
  "status": "PENDING",
  "createdAt": "2025-12-17T...",
  "updatedAt": "2025-12-17T...",
  "player": {
    "id": "player-uuid",
    "name": "defender-1",
    "position": "DEFENDER",
    "value": "120000"
  },
  "team": {
    "id": "team-uuid",
    "name": "user",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  }
}
```

**Note:** Requires team to have more than 15 players.

#### DELETE /transfers/:id
Remove a player from the transfer list.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example Request:**
```
DELETE /transfers/transfer-uuid-here
```

**Response:**
```json
{
  "message": "Transfer removed successfully"
}
```

**Note:** Can only remove transfers from your own team.

#### POST /transfers/:id/buy
Buy a player from another team at 95% of the asking price.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example Request:**
```
POST /transfers/transfer-uuid-here/buy
```

**Response:**
```json
{
  "message": "Player purchased successfully",
  "purchasePrice": 190000,
  "playerId": "player-uuid"
}
```

**Note:** 
- Buyer pays 95% of asking price
- Buyer must have less than 25 players
- Buyer must have sufficient budget
- Seller must have more than 15 players

## Time Report

The following is a detailed breakdown of time spent on each section of the project:

| Task | Time Spent |
|------|------------|
| Cloned and refactored NestJS app template (created 2 months ago) | 1 hour |
| Authentication module (unified register/login flow, JWT, password hashing) | 1.5 hours |
| Team Module (create a team after user registration) | 0.5 hour |
| Transfer Market module (filter, add/remove players, buy players) | 0.5 hour |
| Refactor and review code | 1.5 hours |
| **Total** | **5 hours** |
