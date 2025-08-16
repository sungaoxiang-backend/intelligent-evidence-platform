# Project Structure

## Root Directory
```
├── app/                    # Backend application code
├── frontend/               # Next.js frontend application
├── alembic/               # Database migration files
├── logs/                  # Application logs
├── static/                # Static assets
├── templates/             # Jinja2 templates (if needed)
├── .env                   # Local environment variables
├── .env.docker           # Docker environment variables
├── docker-compose.yaml   # Container orchestration
├── pyproject.toml        # Python project configuration
└── uv.lock              # Dependency lock file
```

## Backend Structure (`app/`)
```
app/
├── api/                   # API route aggregation
│   └── v1.py             # Version 1 API router
├── core/                 # Core configuration and utilities
│   ├── config.py         # Application settings
│   ├── deps.py           # FastAPI dependencies
│   ├── middleware.py     # Custom middleware
│   ├── logging.py        # Logging configuration
│   └── *.yaml           # Configuration files
├── db/                   # Database configuration
│   ├── base.py           # Database models import
│   ├── base_class.py     # Base model class
│   └── session.py        # Database session management
├── [domain]/             # Domain modules (staffs, users, cases, evidences, evidence_chains)
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── routers.py        # FastAPI routes
│   └── services.py       # Business logic
├── agentic/              # AI/ML related functionality
│   ├── agents/           # AI agents
│   ├── llm/              # Language model integrations
│   └── rag/              # RAG implementation
├── integrations/         # Third-party service integrations
├── utils/                # Utility functions
└── main.py              # Application entry point
```

## Frontend Structure (`frontend/`)
```
frontend/
├── app/                  # Next.js App Router pages
│   ├── cases/           # Case management pages
│   ├── staff/           # Staff management pages
│   ├── users/           # User management pages
│   └── globals.css      # Global styles
├── components/          # React components
│   ├── ui/              # Reusable UI components (Radix UI)
│   ├── common/          # Common components
│   └── [feature].tsx    # Feature-specific components
├── lib/                 # Utility libraries
│   ├── api.ts           # API client functions
│   ├── types.ts         # TypeScript type definitions
│   └── utils.ts         # Utility functions
├── hooks/               # Custom React hooks
├── styles/              # Additional stylesheets
└── public/              # Static assets
```

## Domain Module Pattern
Each domain follows a consistent structure:
- **models.py**: SQLAlchemy ORM models with relationships
- **schemas.py**: Pydantic models for request/response validation
- **routers.py**: FastAPI route definitions with dependency injection
- **services.py**: Business logic and database operations

## Configuration Files
- **Core configs**: `app/core/*.yaml` for business rules and evidence types
- **Environment**: `.env` (local) and `.env.docker` (container)
- **Database**: `alembic.ini` and `alembic/` for migrations
- **Frontend**: `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`

## Key Conventions
- All backend modules use async/await patterns
- Database models inherit from `app.db.base_class.Base`
- API routes are prefixed with `/api/v1`
- Frontend components use TypeScript and follow React best practices
- Configuration is environment-based with Pydantic settings