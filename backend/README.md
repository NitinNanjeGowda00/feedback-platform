# Backend

## PostgreSQL-ready runtime

This backend now prefers PostgreSQL for normal runtime.

### Environment setup

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `ADMIN_API_KEY`
- `IP_HASH_SALT`

Example PostgreSQL URL:

```bash
postgresql+psycopg://postgres:postgres@localhost:5432/feedback_app
```

Legacy `postgres://` URLs are normalized automatically. If your host requires TLS, set `DATABASE_SSLMODE=require`.

### Migrations

Run schema migrations with:

```bash
alembic upgrade head
```

Optional validation commands:

```bash
alembic current
alembic heads
```

Do not rely on startup schema creation in PostgreSQL mode. PostgreSQL runtime expects Alembic-managed schema.

### Local legacy SQLite mode

SQLite is still supported only as a compatibility path for older local data.
When using SQLite, startup will create compatibility tables and migrate old `feedback` rows into the new structure.

### Run

```bash
uvicorn app.main:app --reload
```
