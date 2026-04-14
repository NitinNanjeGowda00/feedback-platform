from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

Base = declarative_base()


def _build_database_url_from_railway_pg_vars() -> str | None:
    """
    Railway often exposes these vars when the built-in PostgreSQL plugin is attached.
    This is a safe fallback if DATABASE_URL is not present.
    """
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT", "5432")
    database = os.getenv("PGDATABASE")
    user = os.getenv("PGUSER")
    password = os.getenv("PGPASSWORD")

    if not all([host, database, user, password]):
        return None

    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"


def normalize_database_url(raw_url: str) -> str:
    url = raw_url.strip()
    if not url:
        raise ValueError("DATABASE_URL is empty")

    # Leave SQLite URLs unchanged for local dev if you ever use them.
    if url.startswith("sqlite:"):
        return url

    # Normalize older PostgreSQL URL schemes to psycopg.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    # Optional SSL mode for hosted PostgreSQL.
    sslmode = os.getenv("DATABASE_SSLMODE", "").strip()
    if sslmode and url.startswith("postgresql+") and "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode={sslmode}"

    return url


def get_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raw_url = _build_database_url_from_railway_pg_vars()

    if not raw_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it in your local .env, or attach "
            "Railway PostgreSQL so the database env vars are available."
        )

    return normalize_database_url(raw_url)


DATABASE_URL = get_database_url()
parsed_url = make_url(DATABASE_URL)
IS_SQLITE = parsed_url.get_backend_name() == "sqlite"

engine_kwargs: dict[str, object] = {
    "pool_pre_ping": not IS_SQLITE,
    "future": True,
}

if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "5"))
    engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    engine_kwargs["pool_recycle"] = int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800"))

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)