import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("start_hosted", Path(__file__).parents[1] / "scripts/start_hosted.py")
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


def config():
    return dict(DATABASE_URL="postgresql+psycopg://user:password@db.example.test/demo?sslmode=require",
                RPC_URL="https://rpc.example.test", CHAIN_ID="11155111",
                CONTRACT_ADDRESS="0x" + "1" * 40, DEPLOY_BLOCK="123",
                MASTER_KEY="ab" * 32, PINATA_JWT="test-fixture", IPFS_GATEWAY="https://gateway.example.test",
                ALLOWED_ORIGIN="https://cocomark.example.test", AUTH_DOMAIN="cocomark.example.test")


def test_hosted_config_accepts_https_sepolia_and_separate_db():
    startup.validate_environment(config())


@pytest.mark.parametrize("field,value", [
    ("DATABASE_URL", "postgresql+psycopg://u:p@localhost/food_dev?sslmode=require"),
    ("DATABASE_URL", "postgresql+psycopg://u:p@db.example.test/demo"),
    ("CHAIN_ID", "31337"), ("CONTRACT_ADDRESS", "0x" + "0" * 40),
    ("DEPLOY_BLOCK", "0"), ("MASTER_KEY", ""), ("RPC_URL", "http://127.0.0.1:8545"),
    ("ALLOWED_ORIGIN", "https://app.example.test/path"),
    ("ALLOWED_ORIGIN", "https://app.example.test,https://other.example.test"),
    ("AUTH_DOMAIN", "https://cocomark.example.test"), ("PINATA_JWT", ""),
])
def test_hosted_config_rejects_incomplete_or_local_config(field, value):
    with pytest.raises(ValueError):
        startup.validate_environment({**config(), field: value})
