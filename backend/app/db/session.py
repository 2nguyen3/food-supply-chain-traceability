import functools
from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


def make_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


@functools.lru_cache
def _get_cached_engine(url: str) -> Engine:
    return make_engine(url)


def get_session() -> Generator[Session, None, None]:
    url = get_settings().database_url
    engine = _get_cached_engine(url)
    with Session(engine) as session:
        yield session
