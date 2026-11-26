"""Kiểm thử luồng đầy đủ ở local: contract thật (Hardhat node) + backend + PostgreSQL food_test.

Không phải test của pytest (tên không bắt đầu bằng test_). Chạy tay mỗi khi cần kiểm lại cả luồng.

Chuẩn bị (từ gốc repo):
  1. docker compose up -d db
  2. cd contracts; npx hardhat compile; npx hardhat node        (giữ cửa sổ này mở, cổng 8545)
  3. cd backend; .venv\\Scripts\\python.exe tests\\e2e_local.py [--real-ipfs]

Mặc định IPFS dùng bản giả trong bộ nhớ (không tốn Pinata). --real-ipfs upload thật lên Pinata
(cần PINATA_JWT trong .env). Dùng database TEST_DATABASE_URL (tên phải kết thúc _test), tự dọn sau khi chạy.
Ví thử nghiệm là khóa tạm tạo trong bộ nhớ, không phải ví thật. Thoát mã 1 nếu có bước FAIL.
"""
import argparse
import hashlib
import io
import json
import os
import struct
import sys
import time
import zlib
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "tests"))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO / ".env", override=False)

from eth_account import Account  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from web3 import Web3  # noqa: E402
from web3.exceptions import ContractCustomError, ContractLogicError  # noqa: E402

from app.api.deps import get_chain, get_ipfs  # noqa: E402
from app.core.config import Settings, get_settings  # noqa: E402
from app.db.session import get_session  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.chain import ChainClient  # noqa: E402
from helpers import FakeIpfs, login_headers  # noqa: E402

RPC = "http://127.0.0.1:8545"
CHAIN_ID = 31337
ARTIFACT = REPO / "contracts" / "artifacts" / "contracts" / "FoodTraceability.sol" / "FoodTraceability.json"
sha = lambda b: hashlib.sha256(b).digest()
ZERO32 = b"\x00" * 32
CREATED, IN_TRANSIT, DELIVERED, SOLD = 0, 1, 2, 3

results = {"ok": 0, "fail": 0}


def section(title):
    print(f"\n== {title} ==")


def check(label, got, want=True):
    good = got == want
    results["ok" if good else "fail"] += 1
    print(("OK   " if good else "FAIL ") + label + ("" if good else f"   -> {got!r} (cần {want!r})"))
    return good


def make_png():
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


def main(real_ipfs: bool) -> int:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url or not (make_url(url).database or "").endswith("_test"):
        print("Từ chối chạy: TEST_DATABASE_URL thiếu hoặc không kết thúc bằng _test")
        return 2
    if not os.environ.get("MASTER_KEY"):
        print("Thiếu MASTER_KEY trong .env")
        return 2
    if not ARTIFACT.exists():
        print("Chưa biên dịch contract: cd contracts; npx hardhat compile")
        return 2
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 10}))
    if not w3.is_connected():
        print("Không kết nối được Hardhat node ở 127.0.0.1:8545 (npx hardhat node)")
        return 2

    # ---------- hạ tầng ----------
    eng = create_engine(url, connect_args={"connect_timeout": 5})
    try:
        with eng.connect():
            pass
    except Exception:
        print("Không kết nối được PostgreSQL food_test: bật Docker Desktop rồi chạy 'docker compose up -d db'")
        return 2
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    os.environ["DATABASE_URL"] = url
    with eng.begin() as c0:
        c0.execute(text("DROP SCHEMA public CASCADE"))
        c0.execute(text("CREATE SCHEMA public"))
    command.upgrade(cfg, "head")

    art = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    errors = {}
    for item in art["abi"]:
        if item["type"] == "error":
            sig = f"{item['name']}({','.join(i['type'] for i in item['inputs'])})"
            errors["0x" + Web3.keccak(text=sig)[:4].hex().removeprefix("0x")] = item["name"]
    admin = w3.eth.accounts[0]  # tài khoản có sẵn của Hardhat, đã mở khóa
    receipt = w3.eth.wait_for_transaction_receipt(
        w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"]).constructor().transact({"from": admin}))
    con = w3.eth.contract(address=receipt.contractAddress, abi=art["abi"])

    def adm(fn):
        return w3.eth.wait_for_transaction_receipt(fn.transact({"from": admin}))

    def send(acct, fn):
        tx = fn.build_transaction({"from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address),
                                   "gas": 3_000_000})
        r = w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(acct.sign_transaction(tx).raw_transaction))
        assert r.status == 1, "giao dịch thất bại"
        return r

    def revert_of(fn, acct):
        """Tên custom error nếu giao dịch sẽ revert, ngược lại None (kiểm bằng eth_call)."""
        try:
            fn.call({"from": acct.address})
            return None
        except ContractCustomError as e:
            return errors.get(str(e.data)[:10], str(e.data)[:10])
        except ContractLogicError as e:
            return str(e)

    names = ("farmerA", "farmerB", "logistics", "retailer", "adminlike", "stranger")
    P = {n: Account.create() for n in names}
    for a in P.values():
        w3.eth.wait_for_transaction_receipt(w3.eth.send_transaction({"from": admin, "to": a.address, "value": 10**18}))
    ROLE = lambda n: Web3.keccak(text=n)
    ADMIN = type("Admin", (), {"address": admin})()  # để dùng với revert_of: gọi từ ví Admin

    ipfs = None
    if real_ipfs:
        from app.services.ipfs import get_pinata_client
        ipfs = get_pinata_client()
    else:
        ipfs = FakeIpfs()
    chain = ChainClient(RPC, con.address, chain_id=CHAIN_ID)
    chain.check_chain()
    settings = Settings(database_url=url, auth_domain="food-traceability.local", chain_id=CHAIN_ID,
                        master_key=os.environ["MASTER_KEY"])

    def override_session():
        with Session(eng) as s:
            yield s

    app = create_app([])
    app.dependency_overrides.update({get_session: override_session, get_settings: lambda: settings,
                                     get_chain: lambda: chain, get_ipfs: lambda: ipfs})
    api = TestClient(app)

    # ---------- A. Vai trò ----------
    section("A. Admin cấp vai trò (contract)")
    adm(con.functions.assignFarmer(P["farmerA"].address, "FARM-A"))
    adm(con.functions.assignFarmer(P["farmerB"].address, "FARM-B"))
    adm(con.functions.grantRole(ROLE("LOGISTICS_ROLE"), P["logistics"].address))
    adm(con.functions.grantRole(ROLE("RETAILER_ROLE"), P["retailer"].address))
    adm(con.functions.grantRole(ZERO32, P["adminlike"].address))  # có ADMIN_ROLE, không có vai trò nghiệp vụ
    check("Backend đọc đúng vai trò Farmer A", sorted(chain.get_roles(P["farmerA"].address)), ["FARMER_ROLE"])
    check("Backend đọc đúng vai trò Logistics", sorted(chain.get_roles(P["logistics"].address)), ["LOGISTICS_ROLE"])
    check("Ví lạ không có vai trò", sorted(chain.get_roles(P["stranger"].address)), [])
    check("Người không phải Admin không gán được Farmer",
          revert_of(con.functions.assignFarmer(P["stranger"].address, "X"), P["stranger"]), "AccessControlUnauthorizedAccount")

    # ---------- B. Đăng nhập ----------
    section("B. Đăng nhập bằng chữ ký ví")
    H = {n: login_headers(api, a) for n, a in P.items()}
    check("6 ví đăng nhập được", len(H), 6)
    r = api.post("/documents", data={"doc_type": "image"}, files={"file": ("f", io.BytesIO(make_png()))})
    check("Không có token -> 401", r.status_code, 401)

    # ---------- C. Hồ sơ và tạo lô ----------
    section("C. Farmer A upload bộ 3 hồ sơ, tạo lô COCONUT-001 và bind")
    PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n" + os.urandom(48)
    IMG = make_png()

    def up(who, dtype, content):
        return api.post("/documents", headers=H[who], data={"doc_type": dtype}, files={"file": ("f", io.BytesIO(content))})

    cert, img = up("farmerA", "certificate", PDF).json(), up("farmerA", "image", IMG).json()
    meta_bytes = json.dumps({
        "name": "COCONUT-001", "description": "Dừa xiêm Bến Tre", "image": "ipfs://" + img["cid"],
        "batchCode": "COCONUT-001", "farmId": "FARM-A", "harvestGroupId": "HG-A01",
        "certificateURI": "ipfs://" + cert["cid"], "certificateSHA256": sha(PDF).hex(), "imageSHA256": sha(IMG).hex(),
        "schemaVersion": 1, "cultivar": "Dừa xiêm", "fertilizer": "Hữu cơ", "farmLocation": "Bến Tre",
        "tempMin": 8, "tempMax": 15, "quantityKg": 1000}, ensure_ascii=False).encode()
    r = up("farmerA", "metadata", meta_bytes)
    meta = r.json()
    check("Upload 3 hồ sơ -> 201, draft", (cert["status"], img["status"], r.status_code, meta["status"]), ("draft", "draft", 201, "draft"))
    check("sha256 API khớp byte gốc", (cert["sha256"], img["sha256"], meta["sha256"]), (sha(PDF).hex(), sha(IMG).hex(), sha(meta_bytes).hex()))

    now = w3.eth.get_block("latest")["timestamp"]
    info = lambda code, group: (code, group, "Bến Tre", 1000, now, now + 30 * 86400)
    bad = revert_of(con.functions.createBatch(("X", "HG", "BT", 999, now, now + 100), "cid", ZERO32, ZERO32, ZERO32), P["farmerA"])
    check("createBatch quantityKg 999 -> InvalidQuantity", bad, "InvalidQuantity")
    check("Người không có vai trò Farmer không tạo được lô",
          revert_of(con.functions.createBatch(info("X", "HG"), meta["cid"], sha(meta_bytes), sha(PDF), sha(IMG)), P["stranger"]),
          "AccessControlUnauthorizedAccount")
    r1 = send(P["farmerA"], con.functions.createBatch(info("COCONUT-001", "HG-A01"), meta["cid"], sha(meta_bytes), sha(PDF), sha(IMG)))
    TX1 = "0x" + r1.transactionHash.hex().removeprefix("0x")
    check("Lô 1 tạo xong, chủ là Farmer A", con.functions.ownerOf(1).call(), P["farmerA"].address)
    check("tokenURI = ipfs://CID metadata", con.functions.tokenURI(1).call(), "ipfs://" + meta["cid"])
    check("Trùng mã lô bị chặn", revert_of(con.functions.createBatch(info("COCONUT-001", "HG-A01"), "c", sha(b"1"), sha(b"2"), sha(b"3")), P["farmerA"]), "DuplicateBatchCode")
    for code, group, who in (("COCONUT-002", "HG-A01", "farmerA"), ("COCONUT-003", "HG-A02", "farmerA"), ("COCONUT-004", "HG-B01", "farmerB")):
        send(P[who], con.functions.createBatch(info(code, group), "cid-" + code, sha(code.encode()), sha(b"c" + code.encode()), sha(b"i" + code.encode())))
    check("4 lô trên chain", [con.functions.getTokenIdByCode(f"COCONUT-00{i}").call() for i in (1, 2, 3, 4)], [1, 2, 3, 4])

    bind = lambda who, d, tid="1", tx=TX1: api.post(f"/documents/{d['id']}/bind", headers=H[who], json={"token_id": tid, "tx_hash": tx})
    check("Bind 3 hồ sơ đúng receipt -> 200", [bind("farmerA", d).status_code for d in (cert, img, meta)], [200, 200, 200])
    check("Bind lặp -> 200", bind("farmerA", cert).status_code, 200)
    r = bind("farmerA", cert, tid="2")
    check("Bind chéo sang lô khác -> 409", (r.status_code, r.json()["error"]["code"]), (409, "ALREADY_BOUND"))
    other = up("farmerA", "certificate", b"%PDF-1.4 file khac").json()
    r = bind("farmerA", other)
    check("Hồ sơ khác hash trên chain -> 422 HASH_MISMATCH", (r.status_code, r.json()["error"]["code"]), (422, "HASH_MISMATCH"))
    check("Người không phải uploader bind -> 403", bind("farmerB", other).status_code, 403)

    # ---------- D. Hóa đơn riêng ----------
    section("D. Hóa đơn riêng: mã hóa, cấp quyền, đọc")
    INV = b"%PDF-1.4 HOA DON BI MAT " + os.urandom(120)
    inv = up("farmerA", "invoice", INV).json()
    check("Invoice private, bind không cần tx", (inv["visibility"], api.post(f"/documents/{inv['id']}/bind", headers=H["farmerA"], json={"token_id": "1"}).status_code), ("private", 200))
    if not real_ipfs:
        check("Trên IPFS chỉ có ciphertext", INV[:24] in ipfs.store[inv["cid"]], False)
    G = lambda w: api.post(f"/documents/{inv['id']}/grants", headers=H["farmerA"], json={"wallet": P[w].address}).status_code
    check("Cấp quyền cho Logistics và Retailer", (G("logistics"), G("retailer")), (201, 201))
    check("Ví không có vai trò -> WALLET_NOT_ELIGIBLE", api.post(f"/documents/{inv['id']}/grants", headers=H["farmerA"], json={"wallet": P["stranger"].address}).json()["error"]["code"], "WALLET_NOT_ELIGIBLE")
    READ = lambda who: api.get(f"/documents/{inv['id']}/content", headers=H[who])
    check("Farmer A, Logistics, Retailer đọc đúng byte", [READ(w).content == INV for w in ("farmerA", "logistics", "retailer")], [True, True, True])
    check("Farmer B, Admin, ví lạ -> 403", [READ(w).status_code for w in ("farmerB", "adminlike", "stranger")], [403, 403, 403])
    check("Admin tự cấp quyền cho mình -> 403", api.post(f"/documents/{inv['id']}/grants", headers=H["adminlike"], json={"wallet": P["adminlike"].address}).status_code, 403)

    # ---------- E. Bàn giao 1: Farmer -> Logistics ----------
    section("E. Bàn giao Farmer A -> Logistics")
    fa, lg, rt = P["farmerA"], P["logistics"], P["retailer"]
    H3 = [sha(meta_bytes), sha(PDF), sha(IMG)]
    check("Sai tuyến Farmer -> Retailer", revert_of(con.functions.requestTransfer(1, rt.address), fa), "InvalidRoute")
    check("Người nhận không có vai trò", revert_of(con.functions.requestTransfer(1, P["stranger"].address), fa), "InvalidRoute")
    send(fa, con.functions.requestTransfer(1, lg.address))
    check("Request chưa đổi chủ", (con.functions.ownerOf(1).call(), con.functions.getBatch(1).call()[8]), (fa.address, CREATED))
    check("Yêu cầu thứ hai khi còn chờ", revert_of(con.functions.requestTransfer(1, lg.address), fa), "PendingExists")
    check("Ví khác không nhận hộ được", revert_of(con.functions.acceptTransfer(1, 1, H3), P["stranger"]), "NotRecipient")
    for i, name in enumerate(("metadata", "certificate", "image")):
        wrong = list(H3)
        wrong[i] = sha(b"bi sua")
        check(f"Sai hash {name} -> HashMismatch({i})", revert_of(con.functions.acceptTransfer(1, 1, wrong), lg), "HashMismatch")
    check("requestId cũ/sai -> StaleRequest", revert_of(con.functions.acceptTransfer(1, 99, H3), lg), "StaleRequest")
    send(lg, con.functions.acceptTransfer(1, 1, H3))
    b = con.functions.getBatch(1).call()
    check("Accept đúng: chủ Logistics, trạng thái InTransit", (con.functions.ownerOf(1).call(), b[8]), (lg.address, IN_TRANSIT))
    check("transferFrom trực tiếp bị chặn", revert_of(con.functions.transferFrom(lg.address, rt.address, 1), lg), "DirectTransferDisabled")
    check("approve bị chặn", revert_of(con.functions.approve(rt.address, 1), lg), "DirectTransferDisabled")

    # ---------- F. IoT ----------
    section("F. Logistics ghi 5 bản nhiệt độ (IoT)")
    t = w3.eth.get_block("latest")["timestamp"]
    temps = [1000, 1200, 1800, 1300, 1100]  # 10, 12, 18 (vượt ngưỡng), 13, 11 độ C
    for i, tc in enumerate(temps):
        send(lg, con.functions.recordTransit(1, i + 1, tc, t + 0, "10.77,106.70"))
    logs = con.events.TransitRecorded().get_logs(from_block=0, argument_filters={"tokenId": 1})
    check("5 event TransitRecorded", len(logs), 5)
    check("Đơn vị centi-độ C đúng", [e["args"]["tempCenti"] for e in logs], temps)
    check("Đúng 1 mẫu vượt ngưỡng 8-15 độ C (18 độ)", [e["args"]["tempCenti"] for e in logs if not 800 <= e["args"]["tempCenti"] <= 1500], [1800])
    check("Trùng readingId bị chặn", revert_of(con.functions.recordTransit(1, 1, 1000, t, "x"), lg), "ReadingUsed")
    check("observedAt ở tương lai bị chặn", revert_of(con.functions.recordTransit(1, 9, 1000, t + 99999, "x"), lg), "InvalidObservedAt")
    check("Người không giữ lô không ghi được", revert_of(con.functions.recordTransit(1, 9, 1000, t, "x"), P["stranger"]), "NotTokenOwner")

    # ---------- G. Bàn giao 2 và bán ----------
    section("G. Bàn giao Logistics -> Retailer, bán lô")
    send(lg, con.functions.requestTransfer(1, rt.address))
    send(rt, con.functions.rejectTransfer(1, 2))
    check("Sau reject, owner vẫn Logistics", con.functions.ownerOf(1).call(), lg.address)
    send(lg, con.functions.requestTransfer(1, rt.address))
    send(rt, con.functions.acceptTransfer(1, 3, H3))
    check("Chủ Retailer, trạng thái Delivered", (con.functions.ownerOf(1).call(), con.functions.getBatch(1).call()[8]), (rt.address, DELIVERED))
    check("Logistics (chủ cũ) không còn ghi nhiệt độ được", revert_of(con.functions.recordTransit(1, 20, 1000, t, "x"), lg), "NotTokenOwner")
    check("Retailer vẫn đọc được hóa đơn qua grant", READ("retailer").content == INV, True)
    check("Người lạ không bán được", revert_of(con.functions.markSold(1), P["stranger"]), "NotTokenOwner")
    send(rt, con.functions.markSold(1))
    check("Đã Sold", con.functions.getBatch(1).call()[8], SOLD)
    check("Gọi markSold lần hai -> BatchLocked", revert_of(con.functions.markSold(1), rt), "BatchLocked")
    check("Sold chặn bàn giao tiếp", revert_of(con.functions.requestTransfer(1, lg.address), rt), "BatchLocked")

    # ---------- H. Sự cố và thu hồi ----------
    section("H. Báo sự cố và thu hồi từng lô")
    REPORT = json.dumps({"tokenId": "1", "summary": "Nghi hư hỏng khi nhận hàng"}, ensure_ascii=False).encode()
    rep = up("retailer", "incident_report", REPORT).json()
    check("Farmer upload incident_report -> 403", up("farmerA", "incident_report", REPORT).status_code, 403)
    send(rt, con.functions.reportIncident(1, rep["cid"], bytes.fromhex(rep["sha256"])))
    check("Sự cố ghi on-chain khớp cid/hash của hồ sơ", (con.functions.getIncident(1).call()[3], con.functions.getIncident(1).call()[4].hex()), (rep["cid"], rep["sha256"]))
    check("Bind báo cáo vào đúng lô Retailer giữ", api.post(f"/documents/{rep['id']}/bind", headers=H["retailer"], json={"token_id": "1"}).status_code, 200)
    check("Chỉ Admin thu hồi", revert_of(con.functions.recallBatch(1, 1, "reason", sha(b"r")), rt), "AccessControlUnauthorizedAccount")
    check("incidentId không tồn tại -> UnknownIncident", revert_of(con.functions.recallBatch(1, 99, "reason", sha(b"r")), ADMIN), "UnknownIncident")
    check("Lý do rỗng -> EmptyReason", revert_of(con.functions.recallBatch(1, 1, "", sha(b"r")), ADMIN), "EmptyReason")
    adm(con.functions.recallBatch(1, 1, "reason-cid", sha(b"r")))
    b = con.functions.getBatch(1).call()
    check("Lô Sold vẫn thu hồi được: recalled, vẫn Sold, chủ vẫn Retailer", (b[9], b[8], con.functions.ownerOf(1).call()), (True, SOLD, rt.address))
    check("Thu hồi lần hai -> AlreadyRecalled", revert_of(con.functions.recallBatch(1, 1, "r", sha(b"r")), ADMIN), "AlreadyRecalled")
    recalled = [chain.get_batch(i)["recalled"] for i in (1, 2, 3, 4)]
    check("Chỉ lô 1 bị thu hồi, lô 2, 3, 4 không", recalled, [True, False, False, False])
    check("Truy ngược cùng farm và nhóm: COCONUT-001 và 002 cùng HG-A01 của FARM-A",
          [i for i in (1, 2, 3, 4) if (lambda x: (x[2], x[4]))(con.functions.getBatch(i).call())  == ("FARM-A", "HG-A01")], [1, 2])

    # ---------- I. Lịch sử và vai trò thu hồi ----------
    section("I. Lịch sử chủ sở hữu và thu hồi vai trò")
    tl = con.events.Transfer().get_logs(from_block=0, argument_filters={"tokenId": 1})
    path = [(e["args"]["from"], e["args"]["to"]) for e in tl]
    check("Lịch sử Transfer đúng 3 bản ghi", path, [("0x0000000000000000000000000000000000000000", fa.address), (fa.address, lg.address), (lg.address, rt.address)])
    check("Chủ cuối của lịch sử = ownerOf", path[-1][1], con.functions.ownerOf(1).call())
    adm(con.functions.revokeRole(ROLE("LOGISTICS_ROLE"), lg.address))
    check("Logistics bị thu hồi vai trò on-chain -> mất quyền đọc hóa đơn", READ("logistics").status_code, 403)
    check("Retailer (còn vai trò, còn grant) vẫn đọc được", READ("retailer").status_code, 200)

    # ---------- dọn ----------
    with Session(eng) as s:
        for tb in ("document_grants", "documents", "sessions", "auth_nonces"):
            s.execute(text(f"DELETE FROM {tb}"))
        s.commit()
    print(f"\nKẾT QUẢ: {results['ok']} đạt, {results['fail']} lỗi")
    print("TẤT CẢ ĐẠT" if results["fail"] == 0 else "CÓ LỖI")
    return 0 if results["fail"] == 0 else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--real-ipfs", action="store_true", help="upload thật lên Pinata thay vì bản giả")
    sys.exit(main(ap.parse_args().real_ipfs))
