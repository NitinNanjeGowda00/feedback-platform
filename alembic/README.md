# Alembic migrations

This backend is now prepared for PostgreSQL-ready schema migrations.

## Setup

1. Set `DATABASE_URL`
2. Install backend dependencies
3. Run:

```bash
alembic upgrade head
```

## Notes

- The app currently keeps a lightweight startup compatibility migration for legacy SQLite data.
- Going forward, schema changes should be added as Alembic revisions in `alembic/versions/`.
- For PostgreSQL, use a URL like:

```bash
postgresql+psycopg://user:password@host:5432/dbname
```
