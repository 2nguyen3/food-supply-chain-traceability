import functools
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

REPO_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseModel):
    model_config = {"frozen": True}

    database_url: str = Field(repr=False)
    rpc_url: str | None = None
    chain_id: int | None = None
    contract_address: str | None = None
    deploy_block: int = 0
    pinata_jwt: str | None = Field(default=None, repr=False)
    master_key: str | None = Field(default=None, repr=False)
    allowed_origin: str | None = None
    auth_domain: str | None = None
    token_ttl_minutes: int = 20


@functools.lru_cache
def get_settings() -> Settings:
    load_dotenv(REPO_DIR / ".env", override=False)

    db_url = os.environ.get("DATABASE_URL")
    if not db_url or not db_url.strip():
        raise RuntimeError("Thiếu DATABASE_URL: vui lòng kiểm tra cấu hình biến môi trường.")

    def _get_str(key: str) -> str | None:
        val = os.environ.get(key)
        if val is not None:
            val = val.strip()
            if val:
                return val
        return None

    def _get_int(key: str, default: int | None = None) -> int | None:
        val = _get_str(key)
        if val is not None:
            return int(val)
        return default

    kwargs = {
        "database_url": db_url.strip(),
        "rpc_url": _get_str("RPC_URL"),
        "chain_id": _get_int("CHAIN_ID"),
        "contract_address": _get_str("CONTRACT_ADDRESS"),
        "deploy_block": _get_int("DEPLOY_BLOCK", 0),
        "pinata_jwt": _get_str("PINATA_JWT"),
        "master_key": _get_str("MASTER_KEY"),
        "allowed_origin": _get_str("ALLOWED_ORIGIN"),
        "auth_domain": _get_str("AUTH_DOMAIN"),
        "token_ttl_minutes": _get_int("TOKEN_TTL_MINUTES", 20),
    }

    return Settings(**kwargs)
