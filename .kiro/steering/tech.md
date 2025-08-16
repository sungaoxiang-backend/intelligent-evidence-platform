# Technology Stack

## Backend
- **Framework**: FastAPI (async API service)
- **ORM**: SQLAlchemy 2.0 with async support
- **Database**: PostgreSQL with pgvector extension for vector storage
- **Database Driver**: asyncpg (async PostgreSQL driver)
- **Migration**: Alembic for database schema management
- **Authentication**: JWT tokens with python-jose
- **Password Hashing**: passlib with bcrypt
- **Storage**: Tencent COS (Cloud Object Storage)
- **Dependency Management**: uv (Python package manager)

## Frontend
- **Framework**: Next.js 15 with TypeScript
- **UI Library**: Radix UI components with Tailwind CSS
- **State Management**: SWR for data fetching
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with custom animations
- **Icons**: Lucide React

## Development Tools
- **Code Quality**: Black, isort, Ruff, mypy
- **Testing**: pytest with pytest-asyncio
- **Containerization**: Docker and Docker Compose
- **Python Version**: 3.12+

## Common Commands

### Backend Development
```bash
# Install dependencies
uv sync

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1

# Initialize data
python -m app.initial_data

# Code formatting and linting
black .
isort .
ruff check .
mypy .

# Testing
pytest
```

### Frontend Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Clean cache
npm run clean
```

### Docker Deployment
```bash
# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Architecture Patterns
- **Domain-Driven Design**: Organized by business domains (staffs, users, cases, evidences, evidence_chains)
- **Async/Await**: Full async support throughout the stack
- **Repository Pattern**: Service layer abstracts database operations
- **Dependency Injection**: FastAPI's dependency system for configuration and database sessions
- **API Versioning**: Versioned API routes under `/api/v1`