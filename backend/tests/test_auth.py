"""I03 (nonce replay, hết hạn, sai domain, sai ví) và I04 (hai verify đồng thời) cho P04-05."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.models import AuthNonce
from app.db.session import get_session
from app.main import app
from app.services import auth_service as svc

DOMAIN = "food-traceability.test"
CHAIN_ID = 31337


@pytest.fixture()
def settings(test_database_url):
    return Settings(database_url=test_database_url, auth_domain=DOMAIN, chain_id=CHAIN_ID)


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s
    with Session(engine) as s:
        s.execute(delete(AuthNonce))
        s.commit()


def sign(account, message: str) -> str:
    return account.sign_message(encode_defunct(text=message)).signature.hex()


def new_challenge(session, settings, account, now=None):
    return svc.create_challenge(session, account.address, settings, now=now)


def test_challenge_message_and_ttl(session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct)
    assert row.wallet == acct.address.lower()
    assert row.domain == DOMAIN and row.chain_id == CHAIN_ID
    assert row.expires_at - row.issued_at == timedelta(minutes=5)
    msg = svc.build_message(row)
    assert f"{DOMAIN} wants you to sign in" in msg and row.nonce in msg and f"Chain ID: {CHAIN_ID}" in msg


def test_nonces_are_unique_and_long(session, settings):
    acct = Account.create()
    nonces = {new_challenge(session, settings, acct).nonce for _ in range(5)}
    assert len(nonces) == 5 and all(len(n) >= 32 for n in nonces)


def test_verify_success_returns_lowercase_wallet(session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct)
    wallet = svc.verify_challenge(session, acct.address, row.nonce, sign(acct, svc.build_message(row)))
    assert wallet == acct.address.lower()


def test_replay_is_rejected(session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct)
    sig = sign(acct, svc.build_message(row))
    svc.verify_challenge(session, acct.address, row.nonce, sig)
    with pytest.raises(svc.NonceInvalid):
        svc.verify_challenge(session, acct.address, row.nonce, sig)


def test_expired_nonce_is_rejected(session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct, now=datetime.now(timezone.utc) - timedelta(minutes=10))
    with pytest.raises(svc.NonceInvalid):
        svc.verify_challenge(session, acct.address, row.nonce, sign(acct, svc.build_message(row)))


def test_signature_from_another_wallet_is_rejected_and_nonce_survives(session, settings):
    victim, attacker = Account.create(), Account.create()
    row = new_challenge(session, settings, victim)
    with pytest.raises(svc.SignatureInvalid):
        svc.verify_challenge(session, victim.address, row.nonce, sign(attacker, svc.build_message(row)))
    # chữ ký sai không đốt nonce: chủ ví thật vẫn đăng nhập được
    svc.verify_challenge(session, victim.address, row.nonce, sign(victim, svc.build_message(row)))


def test_nonce_of_another_wallet_is_rejected(session, settings):
    a, b = Account.create(), Account.create()
    row = new_challenge(session, settings, a)
    with pytest.raises(svc.NonceInvalid):
        svc.verify_challenge(session, b.address, row.nonce, sign(b, svc.build_message(row)))


def test_signature_over_other_domain_is_rejected(session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct)
    evil = svc.build_message(row).replace(DOMAIN, "evil.example")
    with pytest.raises(svc.SignatureInvalid):
        svc.verify_challenge(session, acct.address, row.nonce, sign(acct, evil))


def test_unknown_nonce_and_garbage_signature(session, settings):
    acct = Account.create()
    with pytest.raises(svc.NonceInvalid):
        svc.verify_challenge(session, acct.address, "khong-ton-tai", "0x" + "00" * 65)
    row = new_challenge(session, settings, acct)
    with pytest.raises(svc.SignatureInvalid):
        svc.verify_challenge(session, acct.address, row.nonce, "0xdeadbeef")


def test_concurrent_verify_only_one_wins(engine, session, settings):
    acct = Account.create()
    row = new_challenge(session, settings, acct)
    sig, nonce, wallet = sign(acct, svc.build_message(row)), row.nonce, acct.address

    def attempt(_):
        with Session(engine) as s:
            try:
                svc.verify_challenge(s, wallet, nonce, sig)
                return "ok"
            except svc.NonceInvalid:
                return "rejected"

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))
    assert results.count("ok") == 1
    assert results.count("rejected") == 7


def test_challenge_endpoint_and_error_shape(engine, settings):
    def override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        client = TestClient(app)
        acct = Account.create()
        r = client.post("/auth/challenge", json={"wallet": acct.address})
        assert r.status_code == 200
        body = r.json()
        assert body["wallet"] == acct.address.lower() and body["domain"] == DOMAIN
        assert body["chain_id"] == CHAIN_ID and body["nonce"] in body["message"]

        bad = client.post("/auth/challenge", json={"wallet": "0x123"})
        assert bad.status_code == 422 and bad.json() == {
            "error": {"code": "INVALID_WALLET", "message": "Địa chỉ ví không hợp lệ"}
        }
        missing = client.post("/auth/challenge", json={})
        assert missing.status_code == 422 and missing.json()["error"]["code"] == "INVALID_REQUEST"
    finally:
        app.dependency_overrides.clear()
        with Session(engine) as s:
            s.execute(delete(AuthNonce))
            s.commit()
