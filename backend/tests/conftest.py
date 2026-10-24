import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent

# Đọc .env ở gốc repo; biến môi trường đã đặt sẵn được ưu tiên.
load_dotenv(REPO_DIR / ".env", override=False)


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    os.environ["DATABASE_URL"] = url  # alembic/env.py đọc biến này
    return cfg


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.exit("Thiếu TEST_DATABASE_URL (xem .env.example).", returncode=2)
    name = make_url(url).database or ""
    if not name.endswith("_test"):
        pytest.exit(f"Từ chối chạy: database '{name}' không kết thúc bằng _test.", returncode=2)
    return url


@pytest.fixture(scope="session")
def engine(test_database_url):
    """Xóa sạch schema food_test rồi dựng lại bằng alembic upgrade head."""
    saved = os.environ.get("DATABASE_URL")
    eng = create_engine(test_database_url)
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(alembic_config(test_database_url), "head")
    yield eng
    eng.dispose()
    if saved is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = saved


@pytest.fixture()
def db(engine):
    """Session ORM trong một giao dịch, tự rollback sau mỗi test."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()
