"""Bản giả của chain và IPFS cho test backend (adapter thay được), cùng hàm đăng nhập ví."""
import hashlib

from eth_account import Account
from eth_account.messages import encode_defunct

from app.services.chain import BUSINESS_ROLES, ReceiptInvalid, ReceiptNotFound
from app.services.ipfs import IpfsFetchError

sha = lambda b: hashlib.sha256(b).digest()


class FakeChain:
    def __init__(self):
        self.roles: dict[str, set[str]] = {}
        self.batches: dict[int, dict] = {}
        self.creators: dict[int, str] = {}
        self.owners: dict[int, str] = {}
        self.receipts: dict[str, dict] = {}
        self.down = False

    def _alive(self):
        if self.down:
            from app.services.chain import ChainUnavailable
            raise ChainUnavailable("rpc giả đã chết")

    def give(self, wallet: str, *roles: str):
        self.roles.setdefault(wallet.lower(), set()).update(roles)

    def take(self, wallet: str, *roles: str):
        self.roles.setdefault(wallet.lower(), set()).difference_update(roles)

    def has_role(self, wallet: str, role: str) -> bool:
        self._alive()
        return role in self.roles.get(wallet.lower(), set())

    def has_business_role(self, wallet: str) -> bool:
        self._alive()
        return any(r in self.roles.get(wallet.lower(), set()) for r in BUSINESS_ROLES)

    def create_batch(self, token_id: int, farmer: str, tx: str, metadata_cid: str, metadata: bytes,
                     certificate: bytes, image: bytes) -> None:
        self.receipts[tx] = {"token_id": token_id, "farmer": farmer.lower(), "metadata_cid": metadata_cid,
                             "metadata_hash": sha(metadata)}
        self.batches[token_id] = {"certificateHash": sha(certificate), "imageHash": sha(image)}
        self.creators[token_id] = farmer.lower()
        self.owners[token_id] = farmer.lower()

    def get_batch_created(self, tx_hash: str) -> dict:
        self._alive()
        if tx_hash not in self.receipts:
            raise ReceiptNotFound()
        r = self.receipts[tx_hash]
        if r.get("invalid"):
            raise ReceiptInvalid(r["invalid"])
        return r

    def get_batch(self, token_id: int):
        self._alive()
        return self.batches.get(token_id)

    def get_batch_creator(self, token_id: int, from_block: int = 0):
        self._alive()
        return self.creators.get(token_id)

    def owner_of(self, token_id: int):
        self._alive()
        return self.owners.get(token_id)


class FakeIpfs:
    def __init__(self):
        self.store: dict[str, bytes] = {}
        self.fail_fetch = False
        self.fail_upload = False

    def upload(self, content: bytes, filename: str, mime_type: str = "x") -> str:
        from app.services.ipfs import IpfsUploadError
        if self.fail_upload:
            raise IpfsUploadError("pinata giả lỗi")
        cid = "bafy" + hashlib.sha256(content).hexdigest()[:40]
        self.store[cid] = content
        return cid

    def fetch(self, cid: str) -> bytes:
        if self.fail_fetch:
            raise IpfsFetchError("gateway giả lỗi")
        return self.store[cid]


def login_headers(client, account) -> dict:
    ch = client.post("/auth/challenge", json={"wallet": account.address}).json()
    sig = account.sign_message(encode_defunct(text=ch["message"])).signature.hex()
    r = client.post("/auth/verify", json={"wallet": account.address, "nonce": ch["nonce"], "signature": sig})
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def new_wallets(*names: str) -> dict:
    return {n: Account.create() for n in names}
