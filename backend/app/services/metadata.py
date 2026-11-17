"""Kiểm metadata.json của lô (P04-03).

DApp tạo JSON và giữ nguyên một chuỗi byte; backend chỉ kiểm cấu trúc rồi tính SHA-256 trên
**đúng byte nhận được** (`upload_rules.sha256_of`). Không parse rồi stringify lại JSON: đổi một
khoảng trắng cũng đổi hash.
"""
import json
import re

QUANTITY_KG = 1000
SHA256_HEX = re.compile(r"^(0x)?[0-9a-fA-F]{64}$")

STRING_FIELDS = (
    "name", "description", "batchCode", "farmId", "harvestGroupId", "cultivar", "fertilizer", "farmLocation",
)
REQUIRED_FIELDS = STRING_FIELDS + (
    "image", "certificateURI", "certificateSHA256", "imageSHA256", "schemaVersion", "tempMin", "tempMax", "quantityKg",
)


class MetadataInvalid(ValueError):
    pass


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def check_metadata(content: bytes) -> dict:
    """Trả dict đã parse (chỉ để đọc; không dùng để sinh lại byte). Sai thì ném MetadataInvalid."""
    try:
        data = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise MetadataInvalid("Metadata phải là JSON UTF-8 hợp lệ") from None
    if not isinstance(data, dict):
        raise MetadataInvalid("Metadata phải là một đối tượng JSON")

    missing = [k for k in REQUIRED_FIELDS if k not in data]
    if missing:
        raise MetadataInvalid(f"Thiếu trường: {', '.join(missing)}")
    if "metadataHash" in data:
        raise MetadataInvalid("Không đặt metadataHash trong chính metadata (tham chiếu vòng)")

    for k in STRING_FIELDS:
        if not isinstance(data[k], str) or not data[k].strip():
            raise MetadataInvalid(f"{k} phải là chuỗi không rỗng")
    for k in ("image", "certificateURI"):
        if not isinstance(data[k], str) or not data[k].startswith("ipfs://") or len(data[k]) <= len("ipfs://"):
            raise MetadataInvalid(f"{k} phải có dạng ipfs://CID")
    for k in ("certificateSHA256", "imageSHA256"):
        if not isinstance(data[k], str) or not SHA256_HEX.match(data[k]):
            raise MetadataInvalid(f"{k} phải là SHA-256 dạng hex (64 ký tự)")
    if isinstance(data["schemaVersion"], bool) or not isinstance(data["schemaVersion"], int) or data["schemaVersion"] < 1:
        raise MetadataInvalid("schemaVersion phải là số nguyên dương")
    if not _is_number(data["tempMin"]) or not _is_number(data["tempMax"]) or data["tempMin"] > data["tempMax"]:
        raise MetadataInvalid("tempMin, tempMax phải là số và tempMin <= tempMax")
    if data["quantityKg"] != QUANTITY_KG or isinstance(data["quantityKg"], bool):
        raise MetadataInvalid(f"quantityKg phải bằng {QUANTITY_KG}")
    return data
