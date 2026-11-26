"""P06-10..14: cảm biến giả lập, ký recordTransit bằng ví Logistics."""
import argparse
import csv
import json
import math
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import TimeExhausted, TransactionNotFound

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ["chainId", "contract", "genesisHash", "wallet", "tokenId", "readingId",
          "tempCenti", "observedAt", "location", "txHash", "status", "gasUsed"]


class SimulationError(Exception):
    pass


def integer(value, label, maximum=2**256 - 1):
    if not re.fullmatch(r"[0-9]+", str(value)) or int(value) > maximum:
        raise SimulationError(f"{label} phải là số nguyên không âm hợp lệ.")
    return int(value)


def read_rows(path, token_override=None, count=None):
    with Path(path).open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        required = {"readingId", "tokenId", "tempCenti", "observedAt", "location"}
        if not required.issubset(reader.fieldnames or []):
            raise SimulationError("CSV cần readingId, tokenId, tempCenti, observedAt, location.")
        rows, seen = [], set()
        for line, item in enumerate(reader, 2):
            if None in item or any(item.get(field) is None for field in required):
                raise SimulationError(f"Dòng {line}: số cột CSV không hợp lệ.")
            token = integer(str(token_override) if token_override is not None else item["tokenId"], "tokenId")
            reading = integer(item["readingId"], "readingId")
            if token == 0:
                raise SimulationError("tokenId phải lớn hơn 0.")
            if not re.fullmatch(r"-?[0-9]+", item["tempCenti"] or ""):
                raise SimulationError(f"Dòng {line}: tempCenti phải là số nguyên (1250 = 12,50°C).")
            temp = int(item["tempCenti"])
            if not -(2**31) <= temp < 2**31:
                raise SimulationError(f"Dòng {line}: tempCenti vượt giới hạn int32.")
            observed = item["observedAt"].strip()
            if observed != "now":
                observed = integer(observed, "observedAt", 2**64 - 1)
            location = item["location"].strip()
            if not location or (token, reading) in seen:
                raise SimulationError(f"Dòng {line}: thiếu vị trí hoặc trùng tokenId/readingId.")
            seen.add((token, reading))
            rows.append(dict(tokenId=token, readingId=reading, tempCenti=temp,
                             observedAt=observed, location=location))
        if not rows:
            raise SimulationError("CSV không có bản ghi.")
        return rows[:count] if count else rows


def settings(args):
    manifest = json.loads(Path(args.manifest).read_text()) if args.manifest else {}
    fields = {"CHAIN_ID": "chainId", "CONTRACT_ADDRESS": "address",
              "DEPLOY_BLOCK": "deployBlock", "IOT_LOGISTICS_ADDRESS": "logisticsAddress"}
    configured = os.getenv("RPC_URL") and all(
        os.getenv(env) or manifest.get(field) is not None for env, field in fields.items()
    )
    needs_key = not args.dry_run and not args.receipt and not os.getenv("IOT_PRIVATE_KEY")
    if not configured or needs_key:
        load_dotenv(ROOT / ".env", override=False)
        load_dotenv(ROOT / "iot" / ".env", override=False)
    def choose(env, field, default=None):
        value = os.getenv(env)
        other = manifest.get(field)
        if value and other is not None and str(value).lower() != str(other).lower():
            raise SimulationError(f"{env} khác manifest; cần dùng cùng deployment.")
        return value if value else other if other is not None else default
    chain = integer(choose("CHAIN_ID", "chainId", "31337"), "CHAIN_ID")
    if chain not in (31337, 11155111):
        raise SimulationError("Chỉ hỗ trợ Hardhat 31337 hoặc Sepolia 11155111.")
    address = choose("CONTRACT_ADDRESS", "address")
    wallet = choose("IOT_LOGISTICS_ADDRESS", "logisticsAddress")
    for value, label in [(address, "CONTRACT_ADDRESS"), (wallet, "IOT_LOGISTICS_ADDRESS")]:
        if not Web3.is_address(value or "") or int(value, 16) == 0:
            raise SimulationError(f"Thiếu hoặc sai {label}.")
    rpc = os.getenv("RPC_URL", "http://127.0.0.1:8545" if chain == 31337 else "")
    if not rpc.startswith(("http://", "https://")):
        raise SimulationError("Cần RPC_URL HTTP(S) hợp lệ.")
    return dict(chain=chain, address=Web3.to_checksum_address(address),
                wallet=Web3.to_checksum_address(wallet), rpc=rpc,
                deploy_block=integer(choose("DEPLOY_BLOCK", "deployBlock", "0"), "DEPLOY_BLOCK"))


def connect(config, abi_path, check_role=True):
    w3 = Web3(Web3.HTTPProvider(config["rpc"], request_kwargs={"timeout": 15}))
    if not w3.is_connected():
        raise SimulationError("Không kết nối được RPC. Kiểm tra node và RPC_URL.")
    if w3.eth.chain_id != config["chain"]:
        raise SimulationError("RPC đang ở chainId khác cấu hình.")
    if not w3.eth.get_code(config["address"]):
        raise SimulationError("Chưa có contract tại địa chỉ cấu hình.")
    data = json.loads(Path(abi_path).read_text())
    abi = data["abi"] if isinstance(data, dict) else data
    contract = w3.eth.contract(address=config["address"], abi=abi)
    if check_role and not contract.functions.hasRole(contract.functions.LOGISTICS_ROLE().call(), config["wallet"]).call():
        raise SimulationError("Ví cấu hình không còn vai trò Logistics.")
    if config["deploy_block"] > w3.eth.block_number:
        raise SimulationError("DEPLOY_BLOCK nằm sau block hiện tại.")
    return w3, contract


def readings_on_chain(w3, contract, token, start):
    events = {}
    latest = w3.eth.block_number
    for lo in range(start, latest + 1, 2000):
        for event in contract.events.TransitRecorded().get_logs(
            from_block=lo, to_block=min(lo + 1999, latest), argument_filters={"tokenId": token}
        ):
            events[int(event["args"]["readingId"])] = event["args"]
    return events


def validate_batch(w3, contract, config, row):
    token = row["tokenId"]
    batch = contract.functions.getBatch(token).call()
    if contract.functions.ownerOf(token).call().lower() != config["wallet"].lower():
        raise SimulationError(f"NFT #{token} không thuộc ví Logistics cấu hình.")
    # Batch ABI: lifecycle ở vị trí 8; recalled ở vị trí 9.
    if int(batch[8]) != 1 or batch[9] or contract.functions.isExpired(token).call():
        raise SimulationError(f"Lô #{token} phải InTransit, chưa hết hạn và chưa thu hồi.")
    if not contract.functions.hasRole(contract.functions.LOGISTICS_ROLE().call(), config["wallet"]).call():
        raise SimulationError("Vai trò Logistics đã bị thu hồi.")
    observed = w3.eth.get_block("latest")["timestamp"] if row["observedAt"] == "now" else row["observedAt"]
    fn = contract.functions.recordTransit(token, row["readingId"], row["tempCenti"], observed, row["location"])
    try:
        fn.call({"from": config["wallet"]})
    except Exception:
        raise SimulationError(f"Contract từ chối reading #{row['readingId']}; kiểm trạng thái, ID và thời điểm quan sát.") from None
    return fn, observed


def append_journal(path, record):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fresh = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        if fresh:
            writer.writeheader()
        writer.writerow(record)
        file.flush()
        os.fsync(file.fileno())


def receipt(w3, tx_hash, timeout):
    try:
        return w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout, poll_latency=1)
    except TimeExhausted:
        raise SimulationError(f"Chưa có receipt: {tx_hash}. Dừng gửi; dùng --receipt {tx_hash} để kiểm tra lại.") from None


def run(args):
    config = settings(args)
    w3, contract = connect(config, args.abi, check_role=not bool(args.receipt))
    genesis = Web3.to_hex(w3.eth.get_block(0)["hash"])
    if args.receipt:
        if not re.fullmatch(r"0x[0-9a-fA-F]{64}", args.receipt):
            raise SimulationError("txHash phải là 0x và 64 ký tự hex.")
        result = receipt(w3, args.receipt, args.timeout)
        tx = w3.eth.get_transaction(args.receipt)
        if (tx["from"].lower() != config["wallet"].lower() or
                not tx["to"] or tx["to"].lower() != config["address"].lower()):
            raise SimulationError("Giao dịch không thuộc ví/contract cấu hình.")
        print(f"Receipt: {args.receipt} status={result['status']} gasUsed={result['gasUsed']}")
        return 0 if result["status"] == 1 else 1
    rows = read_rows(args.csv, args.token_id, args.count)
    account = None
    if not args.dry_run:
        key = os.getenv("IOT_PRIVATE_KEY")
        if not key:
            raise SimulationError("Thiếu IOT_PRIVATE_KEY; dry-run chỉ cần địa chỉ Logistics.")
        try:
            account = w3.eth.account.from_key(key)
        except Exception:
            raise SimulationError("IOT_PRIVATE_KEY sai định dạng.") from None
        if account.address.lower() != config["wallet"].lower():
            raise SimulationError("Khóa ký không khớp IOT_LOGISTICS_ADDRESS.")
    identity = dict(chainId=str(config["chain"]), contract=config["address"],
                    genesisHash=genesis, wallet=config["wallet"])
    if Path(args.output).exists():
        with Path(args.output).open(encoding="utf-8", newline="") as file:
            journal = list(csv.DictReader(file))
        latest = {}
        for entry in journal:
            if any(entry.get(k) != v for k, v in identity.items()):
                raise SimulationError("Journal thuộc mạng/deployment/ví khác; dùng output riêng cho mỗi lần dựng mạng.")
            latest[entry.get("txHash")] = entry
        for entry in latest.values():
            if entry.get("status") == "prepared":
                try:
                    previous = w3.eth.get_transaction_receipt(entry["txHash"])
                except TransactionNotFound:
                    raise SimulationError(f"Giao dịch cũ chưa rõ kết quả: {entry['txHash']}. Kiểm --receipt trước khi gửi tiếp.") from None
                append_journal(args.output, {**entry, "status": "confirmed" if previous["status"] == 1 else "reverted",
                                             "gasUsed": previous["gasUsed"]})
                if previous["status"] != 1:
                    raise SimulationError("Giao dịch cũ đã revert; kiểm dữ liệu trước khi gửi tiếp.")
    known = {token: readings_on_chain(w3, contract, token, config["deploy_block"]) for token in {r["tokenId"] for r in rows}}
    for row in rows:
        old = known[row["tokenId"]].get(row["readingId"])
        if old and (int(old["tempCenti"]) != row["tempCenti"] or old["location"] != row["location"] or
                    (row["observedAt"] != "now" and int(old["observedAt"]) != row["observedAt"])):
            raise SimulationError("readingId đã có trên chain với nội dung khác; không gửi lại.")
    sent = 0
    for row in rows:
        if row["readingId"] in known[row["tokenId"]]:
            print(f"Bỏ qua #{row['readingId']}: đã có event khớp trên chain.")
            continue
        fn, observed = validate_batch(w3, contract, config, row)
        if args.dry_run:
            print(f"DRY RUN NFT #{row['tokenId']} reading #{row['readingId']}: {row['tempCenti']/100:g}°C; không gửi giao dịch.")
            continue
        confirmed_nonce = w3.eth.get_transaction_count(account.address, "latest")
        if w3.eth.get_transaction_count(account.address, "pending") != confirmed_nonce:
            raise SimulationError("Ví có giao dịch pending; chờ xử lý xong trước khi gửi simulator.")
        tx = fn.build_transaction({"from": account.address, "chainId": config["chain"], "nonce": confirmed_nonce})
        signed = account.sign_transaction(tx)
        tx_hash = Web3.to_hex(signed.hash)
        record = {**identity, **row, "observedAt": observed, "txHash": tx_hash, "status": "prepared", "gasUsed": ""}
        append_journal(args.output, record)
        try:
            w3.eth.send_raw_transaction(signed.raw_transaction)
        except Exception:
            raise SimulationError(f"RPC chưa xác nhận phát giao dịch {tx_hash}. Không tự gửi lại; dùng --receipt kiểm tra.") from None
        result = receipt(w3, tx_hash, args.timeout)
        ok = result["status"] == 1
        append_journal(args.output, {**record, "status": "confirmed" if ok else "reverted", "gasUsed": result["gasUsed"]})
        if not ok:
            raise SimulationError(f"Giao dịch revert: {tx_hash}; dừng, không báo ghi thành công.")
        print(f"Đã ghi {row['tempCenti']/100:g}°C · {tx_hash} · gasUsed={result['gasUsed']}")
        sent += 1
        if args.interval and row is not rows[-1]:
            time.sleep(args.interval)
    print(f"Hoàn tất: {sent} giao dịch mới. Dữ liệu cảm biến giả lập, receipt thuộc mạng {config['chain']}.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=str(ROOT / "iot/readings.csv"))
    parser.add_argument("--abi", default=str(ROOT / "contracts/abi/FoodTraceability.json"))
    parser.add_argument("--manifest", help="JSON có chainId, address, deployBlock, logisticsAddress")
    parser.add_argument("--token-id", type=int, help="Thay tokenId mẫu bằng lô bạn chọn, vẫn kiểm ownership")
    parser.add_argument("--count", type=int)
    parser.add_argument("--interval", type=float, default=0)
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--receipt", help="Chỉ hỏi receipt, không gửi giao dịch")
    parser.add_argument("--output", default=str(ROOT / ".local-data/iot-transactions.csv"))
    args = parser.parse_args()
    if (args.count is not None and args.count <= 0) or (args.token_id is not None and args.token_id <= 0):
        parser.error("--count và --token-id phải lớn hơn 0")
    if not math.isfinite(args.interval) or args.interval < 0 or not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("interval phải không âm và timeout phải lớn hơn 0, hữu hạn")
    try:
        return run(args)
    except SimulationError as exc:
        print(f"Dừng: {exc}", file=sys.stderr)
    except Exception:
        print("Dừng: không đọc được cấu hình/CSV/ABI hoặc RPC lỗi. Kiểm tra môi trường; không tự gửi lại giao dịch chưa rõ receipt.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
