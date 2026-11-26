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


def assert_test_database(url: str | None) -> str:
    """Từ chối chạy nếu thiếu URL hoặc tên database không kết thúc bằng _test (không bao giờ chạm food_dev)."""
    if not url:
        pytest.exit("Thiếu TEST_DATABASE_URL (xem .env.example).", returncode=2)
    name = make_url(url).database or ""
    if not name.endswith("_test"):
        pytest.exit(f"Từ chối chạy: database '{name}' không kết thúc bằng _test.", returncode=2)
    return url


@pytest.fixture(scope="session")
def test_database_url() -> str:
    return assert_test_database(os.environ.get("TEST_DATABASE_URL"))


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


# ---- API với chain và IPFS giả, trên food_test ----
@pytest.fixture()
def api(engine, test_database_url):
    import secrets
    from types import SimpleNamespace

    from fastapi.testclient import TestClient

    from app.api.deps import get_chain, get_ipfs
    from app.core.config import Settings, get_settings
    from app.db.session import get_session
    from app.main import app
    from helpers import FakeChain, FakeIpfs, login_headers, new_wallets

    chain, ipfs = FakeChain(), FakeIpfs()
    settings = Settings(database_url=test_database_url, auth_domain="food-traceability.test", chain_id=31337,
                        master_key=secrets.token_hex(32))

    def override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides.update({
        get_session: override_session, get_settings: lambda: settings,
        get_chain: lambda: chain, get_ipfs: lambda: ipfs,
    })
    client = TestClient(app)
    people = new_wallets("farmerA", "farmerB", "logistics", "retailer", "admin", "stranger")
    chain.give(people["farmerA"].address, "FARMER_ROLE")
    chain.give(people["farmerB"].address, "FARMER_ROLE")
    chain.give(people["logistics"].address, "LOGISTICS_ROLE")
    chain.give(people["retailer"].address, "RETAILER_ROLE")
    chain.give(people["admin"].address, "ADMIN_ROLE")  # Admin không có vai trò nghiệp vụ
    headers = {n: login_headers(client, a) for n, a in people.items()}
    try:
        yield SimpleNamespace(client=client, chain=chain, ipfs=ipfs, settings=settings, people=people,
                              headers=headers, engine=engine)
    finally:
        app.dependency_overrides.clear()
        with Session(engine) as s:
            for t in ("document_grants", "documents", "sessions", "auth_nonces"):
                s.execute(text(f"DELETE FROM {t}"))
            s.commit()
