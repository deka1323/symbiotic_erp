# Symbiotic ERP

A comprehensive Enterprise Resource Planning system with robust access control, authentication, and authorization capabilities.

## Features

- 🔐 **JWT-based Authentication**: Secure login with session management
- 🛡️ **Role-Based Access Control**: Hierarchical permission system
- 👥 **User Management**: Complete user and role management
- 📊 **Access Control Module**: Manage modules, features, privileges, and roles
- 🎨 **Modern UI**: Clean, responsive interface inspired by GCU ERP
- ⚡ **Performance**: Redis caching for permissions
- 🔒 **Security**: Argon2 password hashing, secure sessions

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Password Hashing**: Argon2
- **Session Management**: Redis
- **State Management**: Redux Toolkit
- **Icons**: Lucide React

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see `.env.example`)

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Seed the database:
   ```bash
   npm run db:seed
   ```

6. Start Redis server

7. Start the development server:
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` and login with:
- **Email**: admin@erp.com
- **Password**: Admin@123

## Project Structure

```
symbiotic_erp/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/         # API routes
│   │   ├── dashboard/   # Dashboard pages
│   │   └── login/       # Login page
│   ├── components/       # React components
│   ├── lib/             # Utilities and helpers
│   │   ├── auth/        # Authentication utilities
│   │   ├── acl/         # Access control logic
│   │   └── middleware/  # API middleware
│   ├── hooks/           # React hooks
│   ├── store/           # Redux store
│   └── config/          # Configuration files
├── prisma/              # Prisma schema and migrations
├── scripts/             # Utility scripts
└── docs/                # Documentation
```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Access Control](docs/ACCESS_CONTROL.md)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database
- `npm run db:studio` - Open Prisma Studio

## License

Private - All rights reserved
