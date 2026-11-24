"""Khởi động bản HTTPS Sepolia; migration dùng database deploy đã cấu hình."""
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs


def validate_environment(env):
    required = ["DATABASE_URL", "RPC_URL", "CHAIN_ID", "CONTRACT_ADDRESS", "DEPLOY_BLOCK",
                "MASTER_KEY", "PINATA_JWT", "IPFS_GATEWAY", "ALLOWED_ORIGIN", "AUTH_DOMAIN"]
    missing = [key for key in required if not env.get(key, "").strip()]
    if missing:
        raise ValueError("Thiếu cấu hình: " + ", ".join(missing))
    if env["CHAIN_ID"] != "11155111":
        raise ValueError("Bản hosted này chỉ dùng Sepolia 11155111.")
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", env["CONTRACT_ADDRESS"]) or int(env["CONTRACT_ADDRESS"], 16) == 0:
        raise ValueError("CONTRACT_ADDRESS không hợp lệ.")
    if not env["DEPLOY_BLOCK"].isdigit() or int(env["DEPLOY_BLOCK"]) < 1:
        raise ValueError("DEPLOY_BLOCK không hợp lệ.")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", env["MASTER_KEY"]):
        raise ValueError("MASTER_KEY hosted cần 64 ký tự hex, giữ cố định sau khi lưu hóa đơn.")
    db = urlparse(env["DATABASE_URL"])
    if db.scheme != "postgresql+psycopg" or db.hostname in (None, "localhost", "127.0.0.1", "::1"):
        raise ValueError("Cần PostgreSQL deploy riêng với driver psycopg.")
    if parse_qs(db.query).get("sslmode", [""])[0] not in ("require", "verify-ca", "verify-full"):
        raise ValueError("DATABASE_URL cần sslmode=require hoặc xác minh TLS.")
    for field in ("RPC_URL", "IPFS_GATEWAY", "ALLOWED_ORIGIN"):
        url = urlparse(env[field])
        if url.scheme != "https" or not url.hostname or url.hostname in ("localhost", "127.0.0.1", "::1"):
            raise ValueError(field + " cần HTTPS công khai.")
    origin = urlparse(env["ALLOWED_ORIGIN"])
    if origin.path not in ("", "/") or origin.query or origin.fragment or origin.username:
        raise ValueError("ALLOWED_ORIGIN phải là một origin HTTPS.")
    if env["AUTH_DOMAIN"] != origin.netloc:
        raise ValueError("AUTH_DOMAIN phải khớp host của ALLOWED_ORIGIN, không chứa https://.")


def main():
    try:
        validate_environment(os.environ)
        port = int(os.environ.get("PORT", "8000"))
        if not 1 <= port <= 65535:
            raise ValueError("PORT không hợp lệ.")
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    os.chdir(Path(__file__).resolve().parents[1])
    # Một instance Free chạy migration trước server; lỗi migration thì không phục vụ app.
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(port)])


if __name__ == "__main__":
    sys.exit(main())
