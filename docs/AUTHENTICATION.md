# Authentication Documentation

## Overview

The Symbiotic ERP uses JWT-based authentication with session management. Authentication is handled through secure tokens stored in HTTP-only cookies and localStorage.

## Authentication Flow

### 1. Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "admin@erp.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@erp.com",
    "username": "admin",
    "fullName": "System Administrator"
  }
}
```

**Process:**
1. User submits email and password
2. Server verifies credentials using Argon2
3. Creates a new session in database
4. Generates access token (15 minutes) and refresh token (7 days)
5. Stores refresh token in Redis
6. Sets refresh token in HTTP-only cookie
7. Returns access token to client

### 2. Token Refresh

**Endpoint:** `POST /api/auth/refresh`

**Process:**
1. Client sends refresh token from cookie
2. Server verifies refresh token
3. Checks Redis for token validity
4. Validates session in database
5. Generates new access token
6. Returns new access token

### 3. Logout

**Endpoint:** `POST /api/auth/logout`

**Process:**
1. Invalidates session in database
2. Deletes refresh token from Redis
3. Clears refresh token cookie
4. Client removes access token from localStorage

### 4. Get Current User

**Endpoint:** `GET /api/auth/me`

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@erp.com",
    "username": "admin",
    "fullName": "System Administrator",
    "isActive": true
  }
}
```

## Security Features

### Password Hashing

- Uses Argon2 for password hashing
- Secure against timing attacks
- Industry-standard algorithm

### Session Management

- Sessions stored in database
- Session expiration (7 days)
- Session invalidation on logout
- IP address and user agent tracking

### Token Security

- Access tokens: Short-lived (15 minutes)
- Refresh tokens: Long-lived (7 days), stored in Redis
- HTTP-only cookies for refresh tokens
- JWT signing with secret keys

## Frontend Integration

### Login Hook

```typescript
import { useAuth } from '@/hooks/useAuth'

const { login, logout, user, isAuthenticated } = useAuth()

// Login
await login(email, password)

// Logout
await logout()
```

### Protected Routes

The dashboard layout automatically redirects unauthenticated users to the login page.

## API Authentication

All protected API routes require an Authorization header:

```
Authorization: Bearer <accessToken>
```

The `authMiddleware` function validates:
1. Token presence
2. Token signature
3. Session validity
4. User active status

## Error Handling

### Common Errors

- `401 Unauthorized`: Invalid or missing token
- `401 Invalid credentials`: Wrong email/password
- `401 Session expired`: Session has expired
- `403 Forbidden`: Insufficient permissions
