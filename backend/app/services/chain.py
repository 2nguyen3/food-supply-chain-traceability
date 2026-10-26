"""Adapter đọc contract FoodTraceability (chỉ đọc, backend không ký giao dịch).

RPC lỗi thì ném ChainUnavailable; tầng gọi phải từ chối chứ không đoán quyền.
"""
import functools
import json
from pathlib import Path

from requests.exceptions import RequestException
from web3 import Web3
from web3.exceptions import BadFunctionCallOutput, ContractLogicError, Web3Exception

from app.core.config import get_settings

ABI_PATH = Path(__file__).parent / "abi" / "FoodTraceability.json"

ADMIN_ROLE = "ADMIN_ROLE"
BUSINESS_ROLES = ("FARMER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE")
LIFECYCLES = ("Created", "InTransit", "Delivered", "Sold")


class ChainUnavailable(Exception):
    """Không đọc được dữ liệu từ chain (RPC lỗi, sai mạng, sai địa chỉ contract)."""


def role_id(role: str) -> bytes:
    if role == ADMIN_ROLE:
        return b"\x00" * 32  # DEFAULT_ADMIN_ROLE
    if role not in BUSINESS_ROLES:
        raise ValueError(f"Vai trò không hợp lệ: {role}")
    return bytes(Web3.keccak(text=role))


class ChainClient:
    def __init__(self, rpc_url: str, contract_address: str, chain_id: int | None = None, timeout: int = 10):
        self._chain_id = chain_id
        self._w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": timeout}))
        abi = json.loads(ABI_PATH.read_text(encoding="utf-8"))["abi"]
        self._contract = self._w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=abi)

    def _call(self, fn):
        try:
            return fn.call()
        except ContractLogicError:
            raise
        except (RequestException, BadFunctionCallOutput, Web3Exception, OSError) as exc:
            raise ChainUnavailable(str(exc)) from exc

    def check_chain(self) -> None:
        """Kiểm RPC trả đúng chainId và địa chỉ có bytecode."""
        try:
            if self._chain_id is not None and self._w3.eth.chain_id != self._chain_id:
                raise ChainUnavailable(f"Sai chainId: RPC trả {self._w3.eth.chain_id}, cần {self._chain_id}")
            if not self._w3.eth.get_code(self._contract.address):
                raise ChainUnavailable("Địa chỉ contract không có bytecode")
        except (RequestException, Web3Exception, OSError) as exc:
            raise ChainUnavailable(str(exc)) from exc

    def has_role(self, wallet: str, role: str) -> bool:
        addr = Web3.to_checksum_address(wallet)
        return bool(self._call(self._contract.functions.hasRole(role_id(role), addr)))

    def get_roles(self, wallet: str) -> frozenset[str]:
        """Các vai trò (kể cả ADMIN_ROLE) mà ví đang giữ."""
        return frozenset(r for r in (ADMIN_ROLE, *BUSINESS_ROLES) if self.has_role(wallet, r))

    def has_business_role(self, wallet: str) -> bool:
        return any(self.has_role(wallet, r) for r in BUSINESS_ROLES)

    def owner_of(self, token_id: int) -> str | None:
        """Địa chỉ (checksum) đang giữ lô; None nếu lô không tồn tại."""
        try:
            return self._call(self._contract.functions.ownerOf(token_id))
        except ContractLogicError:
            return None

    def get_batch(self, token_id: int) -> dict | None:
        """Dữ liệu lô trên chain; None nếu không tồn tại."""
        try:
            b = self._call(self._contract.functions.getBatch(token_id))
        except ContractLogicError:
            return None
        names = [o["name"] for o in self._contract.get_function_by_name("getBatch").abi["outputs"][0]["components"]]
        batch = dict(zip(names, b))
        batch["lifecycle"] = LIFECYCLES[batch["lifecycle"]]
        return batch


@functools.lru_cache
def get_chain_client() -> ChainClient:
    s = get_settings()
    if not s.rpc_url or not s.contract_address:
        raise ChainUnavailable("Thiếu RPC_URL hoặc CONTRACT_ADDRESS")
    return ChainClient(s.rpc_url, s.contract_address, s.chain_id)
