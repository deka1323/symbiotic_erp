# Setup Guide

This guide will help you set up and run the Symbiotic ERP system.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- Redis 6+ installed and running
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/symbiotic_erp"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (change these in production!)
JWT_SECRET="your-secret-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-key-change-in-production"

# Environment
NODE_ENV="development"
```

### 3. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```sql
CREATE DATABASE symbiotic_erp;
```

### 4. Run Prisma Migrations

```bash
npm run db:migrate
```

This will create all the necessary database tables.

### 5. Generate Prisma Client

```bash
npm run db:generate
```

### 6. Seed the Database

```bash
npm run db:seed
```

This will create:
- Default modules (Access Control, HR, Finance)
- Default features and privileges
- Admin role with all permissions
- Admin user (email: `admin@erp.com`, password: `Admin@123`)

### 7. Start Redis Server

**Windows:**
```bash
redis-server
```

**Linux/Mac:**
```bash
redis-server
```

**Or using Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

### 8. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Default Login Credentials

- **Email:** admin@erp.com
- **Password:** Admin@123

## Verification

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Verify Redis is running:
   ```bash
   redis-cli ping
   ```
   Should return `PONG`

3. Access the application:
   - Open `http://localhost:3000`
   - You should be redirected to the login page
   - Login with admin credentials

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check DATABASE_URL in `.env` file
- Ensure database exists

### Redis Connection Issues

- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in `.env` file
- Ensure Redis is accessible on port 6379

### Port Already in Use

If port 3000 is already in use, you can change it:

```bash
PORT=3001 npm run dev
```

## Next Steps

After successful setup:
1. Login with admin credentials
2. Explore the Access Control module
3. Create additional users and roles as needed
4. Configure permissions for your organization
