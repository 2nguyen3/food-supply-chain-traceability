"""Dựng dữ liệu mẫu trên Hardhat node cục bộ để frontend có gì đó để đọc (bản local của seed_demo.py).

Chuẩn bị: cd contracts; npx hardhat compile; npx hardhat node   (node MỚI, giữ cửa sổ mở, cổng 8545)
Chạy:     cd backend; .venv\\Scripts\\python.exe scripts\\seed_local.py

Việc làm: deploy contract (từ tài khoản #0 của Hardhat nên địa chỉ cố định nếu node mới), cấp vai trò cho
tài khoản #1-#4, upload hồ sơ mẫu THẬT lên Pinata (cần PINATA_JWT trong .env), tạo 4 lô COCONUT-001..004
rồi đưa chúng đến các trạng thái khác nhau. Chạy lại trên node đã seed thì từ chối (tránh trùng mã lô).

Tài khoản của Hardhat (khóa riêng công khai, chỉ dùng cho local, KHÔNG phải ví thật):
  #0 Admin, #1 Farmer A, #2 Farmer B, #3 Logistics, #4 Retailer. Khóa in ra khi chạy `npx hardhat node`.
"""
import hashlib
import json
import os
import struct
import sys
import zlib
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO / ".env", override=False)

from web3 import Web3  # noqa: E402

from app.services.ipfs import get_pinata_client  # noqa: E402

RPC = "http://127.0.0.1:8545"
ARTIFACT = REPO / "contracts" / "artifacts" / "contracts" / "FoodTraceability.sol" / "FoodTraceability.json"
sha = lambda b: hashlib.sha256(b).digest()
ZERO32 = b"\x00" * 32


def make_png(width=480, height=320) -> bytes:
    """Ảnh PNG mẫu (nền xanh lá có dải sáng), tạo bằng thư viện chuẩn, không cần Pillow."""
    rows = b""
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            shade = 120 + (x * 60) // width + (y * 40) // height
            row += bytes((40, min(shade, 255), 70))
        rows += bytes(row)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def make_pdf() -> bytes:
    body = b"BT /F1 18 Tf 72 720 Td (CHUNG NHAN MAU - COCOMARK demo, khong phai chung chi that) Tj ET"
    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
        b"<</Length %d>>\nstream\n" % len(body) + body + b"\nendstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    return out + b"trailer<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)


def main() -> int:
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 15}))
    if not w3.is_connected():
        print("Không kết nối được Hardhat node ở 127.0.0.1:8545 (cd contracts; npx hardhat node)")
        return 2
    if not ARTIFACT.exists():
        print("Chưa biên dịch contract: cd contracts; npx hardhat compile")
        return 2
    if not os.environ.get("PINATA_JWT"):
        print("Thiếu PINATA_JWT trong .env (cần upload hồ sơ mẫu lên IPFS)")
        return 2
    ipfs = get_pinata_client()

    admin, farmer_a, farmer_b, logistics, retailer = w3.eth.accounts[:5]
    art = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    nonce0 = w3.eth.get_transaction_count(admin)
    receipt = w3.eth.wait_for_transaction_receipt(
        w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"]).constructor().transact({"from": admin}))
    con = w3.eth.contract(address=receipt.contractAddress, abi=art["abi"])

    def tx(sender, fn):
        r = w3.eth.wait_for_transaction_receipt(fn.transact({"from": sender}))
        assert r.status == 1, "giao dịch thất bại"
        return r

    role = lambda name: Web3.keccak(text=name)
    tx(admin, con.functions.assignFarmer(farmer_a, "FARM-A"))
    tx(admin, con.functions.assignFarmer(farmer_b, "FARM-B"))
    tx(admin, con.functions.grantRole(role("LOGISTICS_ROLE"), logistics))
    tx(admin, con.functions.grantRole(role("RETAILER_ROLE"), retailer))
    print(f"Contract: {con.address}  (deploy block {receipt.blockNumber}, nonce admin {nonce0})")

    print("Upload hồ sơ mẫu lên Pinata…")
    pdf, png = make_pdf(), make_png()
    cert_cid = ipfs.upload(pdf, "certificate.pdf", "application/pdf")
    img_cid = ipfs.upload(png, "batch.png", "image/png")

    now = w3.eth.get_block("latest")["timestamp"]
    lots = [  # mã lô, nhóm, ví chủ, farmId, trạng thái đích
        ("COCONUT-001", "HG-A01", farmer_a, "FARM-A", "sold"),
        ("COCONUT-002", "HG-A01", farmer_a, "FARM-A", "delivered"),
        ("COCONUT-003", "HG-A02", farmer_a, "FARM-A", "intransit"),
        ("COCONUT-004", "HG-B01", farmer_b, "FARM-B", "created"),
    ]
    for token_id, (code, group, farmer, farm_id, target) in enumerate(lots, 1):
        meta = json.dumps({
            "name": code, "description": "Dừa xiêm xanh nguyên trái (dữ liệu mẫu)", "image": f"ipfs://{img_cid}",
            "batchCode": code, "farmId": farm_id, "harvestGroupId": group, "certificateURI": f"ipfs://{cert_cid}",
            "certificateSHA256": sha(pdf).hex(), "imageSHA256": sha(png).hex(), "schemaVersion": 1,
            "cultivar": "Dừa xiêm xanh", "fertilizer": "Phân hữu cơ vi sinh", "farmLocation": "Bến Tre, Việt Nam",
            "tempMin": 8, "tempMax": 15, "quantityKg": 1000,
        }, ensure_ascii=False).encode()
        meta_cid = ipfs.upload(meta, f"{code}.metadata.json", "application/json")
        hashes = [sha(meta), sha(pdf), sha(png)]
        info = (code, group, "Bến Tre, Việt Nam", 1000, now, now + 30 * 86400)
        tx(farmer, con.functions.createBatch(info, meta_cid, *hashes))

        if target == "created":
            continue
        rid = lambda: con.functions.getPendingTransfer(token_id).call()[0]
        tx(farmer, con.functions.requestTransfer(token_id, logistics))
        tx(logistics, con.functions.acceptTransfer(token_id, rid(), hashes))
        if target in ("intransit", "delivered", "sold"):
            for i, temp in enumerate([1000, 1200, 1800, 1300, 1100]):  # 10, 12, 18, 13, 11 °C
                observed = w3.eth.get_block("latest")["timestamp"]
                tx(logistics, con.functions.recordTransit(token_id, i + 1, temp, observed, "10.77,106.70"))
        if target == "intransit":
            continue
        tx(logistics, con.functions.requestTransfer(token_id, retailer))
        tx(retailer, con.functions.acceptTransfer(token_id, rid(), hashes))
        if target == "sold":
            tx(retailer, con.functions.markSold(token_id))
        print(f"  {code}: {target}")

    print("\n=== Cấu hình frontend (frontend/.env.local) ===")
    print(f"VITE_CHAIN_ID=31337\nVITE_PUBLIC_RPC_URL={RPC}\nVITE_CONTRACT_ADDRESS={con.address}\nVITE_DEPLOY_BLOCK={receipt.blockNumber}")
    print("\n=== Tài khoản Hardhat (import khóa từ log của `npx hardhat node` vào MetaMask) ===")
    for name, a in (("Admin #0", admin), ("Farmer A #1", farmer_a), ("Farmer B #2", farmer_b), ("Logistics #3", logistics), ("Retailer #4", retailer)):
        print(f"  {name:14s} {a}")
    print("\nLô: 001 Sold (5 bản nhiệt độ, 1 mẫu 18°C), 002 Delivered, 003 InTransit, 004 Created")
    return 0


if __name__ == "__main__":
    sys.exit(main())
