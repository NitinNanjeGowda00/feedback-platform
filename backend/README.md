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

Legacy `postgres://` URLs are normalized automatically.

### Migrations

Run schema migrations with:

```bash
alembic upgrade head
```

### Local legacy SQLite mode

SQLite is still supported only as a compatibility path for older local data.
When using SQLite, startup will create compatibility tables and migrate old `feedback` rows into the new structure.

### Run

```bash
uvicorn app.main:app --reload
```
