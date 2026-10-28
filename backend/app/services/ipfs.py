"""Adapter Pinata (IPFS). Upload byte nguyên bản lên network public và trả CID.

Lỗi mạng hoặc Pinata từ chối thì ném IpfsUploadError; tầng gọi trả 502 IPFS_UPLOAD_FAILED
và không tạo bản ghi. Không ghi JWT ra log hay thông báo lỗi.
"""
import functools
import re

import httpx

from app.core.config import get_settings

UPLOAD_URL = "https://uploads.pinata.cloud/v3/files"
GATEWAYS = ("https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/")  # thử lần lượt
MAX_FETCH_BYTES = 11 * 1024 * 1024  # 10 MB nội dung + phần đầu gói mã hóa
CID_PATTERN = re.compile(r"^[A-Za-z0-9]{10,200}$")


class IpfsUploadError(Exception):
    """Upload lên IPFS thất bại; có thể thử lại."""


class IpfsFetchError(Exception):
    """Không tải được nội dung từ IPFS (gateway lỗi, hết thời gian, quá lớn)."""


class PinataClient:
    def __init__(self, jwt: str, timeout: float = 30.0, upload_url: str = UPLOAD_URL):
        self._jwt = jwt
        self._timeout = timeout
        self._upload_url = upload_url

    def upload(self, content: bytes, filename: str, mime_type: str = "application/octet-stream") -> str:
        """Upload `content` nguyên byte, trả CID. Network luôn là public."""
        try:
            resp = httpx.post(
                self._upload_url,
                headers={"Authorization": f"Bearer {self._jwt}"},
                data={"network": "public", "name": filename},
                files={"file": (filename, content, mime_type)},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            cid = resp.json()["data"]["cid"]
        except httpx.HTTPStatusError as exc:
            raise IpfsUploadError(f"Pinata trả HTTP {exc.response.status_code}") from None
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise IpfsUploadError(f"Upload IPFS lỗi: {type(exc).__name__}") from None
        if not cid:
            raise IpfsUploadError("Pinata không trả CID")
        return cid


    def fetch(self, cid: str, timeout: float = 20.0, gateways: tuple[str, ...] = GATEWAYS) -> bytes:
        """Tải nội dung theo CID qua gateway công khai; thử lần lượt, quá giới hạn kích thước thì bỏ."""
        if not CID_PATTERN.match(cid):
            raise IpfsFetchError("CID không hợp lệ")
        for gateway in gateways:
            try:
                with httpx.stream("GET", gateway + cid, timeout=timeout, follow_redirects=True) as resp:
                    resp.raise_for_status()
                    data = b""
                    for chunk in resp.iter_bytes():
                        data += chunk
                        if len(data) > MAX_FETCH_BYTES:
                            raise IpfsFetchError("Nội dung IPFS vượt giới hạn")
                    return data
            except IpfsFetchError:
                raise
            except httpx.HTTPError:
                continue
        raise IpfsFetchError("Không tải được từ các gateway IPFS")


@functools.lru_cache
def get_pinata_client() -> PinataClient:
    jwt = get_settings().pinata_jwt
    if not jwt:
        raise IpfsUploadError("Thiếu PINATA_JWT")
    return PinataClient(jwt)
