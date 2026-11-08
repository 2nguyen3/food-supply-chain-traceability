import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))
from dfw import *  # noqa



# ================= 01 Architecture =================
d = D("Kiến trúc tổng thể", "Kiến trúc hệ thống Food Supply Chain Traceability")
users = d.box("<b>Admin · Farmer · Logistics · Retailer</b><br>Trình duyệt + MetaMask<br>(ký giao dịch)", 40, 170, 230, 90, GREY)
cons = d.box("<b>Consumer</b><br>Trình duyệt / camera quét QR<br>(không cần ví)", 40, 300, 230, 100, GREY)
dapp = d.box("<b>Web DApp</b><br>React 19 · Vite 7 · ethers 6<br>host tĩnh HTTPS", 350, 190, 300, 100, BLUE)
api = d.box("<b>Backend API</b><br>FastAPI (Python 3.12)<br>đăng nhập chữ ký ví · AES-256-GCM · ACL", 890, 190, 320, 100, ORANGE)
pin = d.box("<b>Pinata / IPFS (public)</b><br>certificate.pdf · batch.jpg · metadata.json<br>ciphertext hóa đơn", 890, 40, 320, 90, PURPLE)
chain = d.box("<b>Ethereum Sepolia</b><br>FoodTraceability.sol<br>ERC-721 · AccessControl · ReentrancyGuard", 350, 430, 300, 100, GREEN)
pg = d.box("<b>PostgreSQL</b><br>auth_nonces · sessions<br>documents · document_grants", 980, 430, 230, 100, GREEN)
iot = d.box("<b>IoT Simulator</b><br>Python + web3.py 7.13 · readings.csv<br>ví Logistics ký", 350, 610, 300, 90, YELLOW)
d.edge(users, dapp, (270, 215), (350, 215))
d.edge(cons, dapp, (270, 340), (350, 265), via=[(310, 340), (310, 265)])
d.edge(dapp, api, (650, 240), (890, 240))
d.elabel("Bearer token<br>upload · tải tài liệu riêng", 770, 200, 220)
d.edge(api, pin, (1050, 190), (1050, 130))
d.elabel("upload / retrieve<br>(PINATA_JWT)", 1058, 160, 170, align="l")
d.edge(dapp, pin, (500, 190), (890, 85), via=[(500, 85)], dashed=True)
d.elabel("trang trace đọc hồ sơ trực tiếp từ IPFS", 700, 120, 260)
d.edge(dapp, chain, (500, 290), (500, 430))
d.elabel("ghi: MetaMask → RPC<br>đọc: getBatch · tokenURI · Transfer<br>hasRole (vai trò khi đăng nhập)", 510, 360, 260, align="l")
d.edge(api, pg, (1100, 290), (1100, 430))
d.elabel("nonce · phiên · ACL<br>wrapped key", 1110, 360, 130, align="l")
d.edge(api, chain, (930, 290), (650, 480), via=[(930, 480)], dashed=True)
d.elabel("đọc vai trò · receipt BatchCreated", 790, 440, 260)
d.edge(iot, chain, (500, 610), (500, 530))
d.elabel("recordTransit<br>(ví Logistics ký)", 510, 570, 130, align="l")
d.note("Trang trace công khai chỉ dùng RPC + IPFS, không phụ thuộc backend hay DB.<br>"
       "DB không phải nguồn sự thật cho owner / trạng thái lô.<br>"
       "Backend không giữ khóa ví để ký hộ người dùng.", 790, 590, 420)
done(d, "01-architecture.drawio")

# ================= 02 Business process =================
d = D("Quy trình nghiệp vụ", "Quy trình từ nông trại đến người tiêu dùng")
steps = [
    ("Trồng trọt tại nông trại", "Farmer · ngoài chuỗi",
     "Giống, phân bón, vị trí ghi trong hồ sơ ngoài chuỗi. Không tạo giao dịch cho từng hoạt động canh tác."),
    ("Thu hoạch và đóng gói", "Farmer",
     "Upload hồ sơ lên IPFS → createBatch mint NFT cho lô 1.000 kg.<br><b>CTE:</b> BatchCreated, Transfer (từ zero address)"),
    ("Vận chuyển", "Farmer → Logistics",
     "request / accept bàn giao; Logistics ghi nhiệt độ + vị trí bằng recordTransit.<br>"
     "<b>CTE:</b> TransferRequested, TransferAccepted, Transfer, TransitRecorded"),
    ("Tiếp nhận và bán lẻ", "Logistics → Retailer",
     "Retailer xác minh 3 hash rồi accept → Delivered. Bán hết nguyên lô → markSold.<br>"
     "<b>CTE:</b> TransferAccepted, Transfer, BatchSold"),
    ("Người tiêu dùng truy xuất", "Consumer · không cần ví",
     "Quét QR, xem lịch sử, chứng chỉ gốc và ảnh lô trên IPFS. Không nhận NFT trong mô hình demo."),
]
y = 70
ids = []
for name, who, note in steps:
    nh = est_h(note, 560 - 12, 14, 14)
    h = max(70, nh)
    b = d.box(f"<b>{name}</b><br>{who}", 160, y + (h - 70) / 2, 280, 70, BLUE)
    d.note(note, 480, y, 560, h)
    ids.append((b, y + (h - 70) / 2))
    y += h + 44
for (a, ya), (b, yb) in zip(ids, ids[1:]):
    d.edge(a, b, (300, ya + 70), (300, yb))
inc_y = y + 10
inc = d.box("<b>Xử lý sự cố</b><br>Retailer · Admin<br>reportIncident → truy ngược farmId + harvestGroupId → recallBatch từng lô",
            160, inc_y, 280, 120, RED)
d.note("<b>CTE:</b> IncidentReported, BatchRecalled. Admin xét từng lô, không tự thu hồi cả trang trại. "
       "Lô đã thu hồi hiện cảnh báo trên QR, kể cả khi đã Sold.", 480, inc_y, 560)
d.edge(ids[3][0], inc, (160, ids[3][1] + 35), (160, inc_y + 60), via=[(40, ids[3][1] + 35), (40, inc_y + 60)], dashed=True)
d.elabel("phát hiện sự cố<br>tại siêu thị", 50, inc_y - 40, 100, align="l")
done(d, "02-nghiep-vu.drawio")

# ================= 03 Batch state =================
d = D("Vòng đời lô hàng", "Vòng đời của một lô hàng")
start = d.vertex("box", "", 40, 128, 26, 26, "ellipse;html=1;fillColor=#1a1a1a;strokeColor=#1a1a1a;")
X = [130, 520, 910, 1300]
SW, SH = 190, 100
st = []
for x, (nm, own) in zip(X, [("Created", "Farmer giữ"), ("InTransit", "Logistics giữ"),
                            ("Delivered", "Retailer giữ"), ("Sold", "Retailer giữ NFT")]):
    st.append(d.box(f"<b>{nm}</b><br>{own}", x, 100, SW, SH, GREEN if nm == "Sold" else BLUE, 16))
d.edge(start, st[0], (66, 141), (130, 141))
d.elabel("Farmer tạo lô", 70, 88, 120)
steps = ["Logistics nhận hàng", "Retailer nhận hàng", "Retailer bán hết"]
for i in range(3):
    xa, xb = X[i] + SW, X[i + 1]
    d.edge(st[i], st[i + 1], (xa, 150), (xb, 150))
    d.elabel(steps[i], (xa + xb) / 2, 120, xb - xa - 10)
d.text("Việc được làm ở mỗi trạng thái", 130, 235, 400, 26, TEXTL + "fontStyle=1;", 14)
todo = [
    "Farmer đề nghị bàn giao cho Logistics",
    "Logistics ghi nhiệt độ, vị trí; đề nghị bàn giao cho Retailer",
    "Retailer bán hết lô hoặc báo sự cố",
    "Chỉ còn báo sự cố",
]
for x, t in zip(X, todo):
    d.box(t, x, 270, SW, 100, WHITE, 14)
d.note("Đề nghị bàn giao chưa đổi chủ: chỉ khi bên nhận xác minh hồ sơ và chấp nhận thì chủ lô và trạng thái mới đổi. "
       "Bị từ chối hoặc hủy thì lô giữ nguyên.", 130, 400, 970)
d.zone("Hai tình huống làm lô bị khóa (xảy ra ở bất kỳ trạng thái nào)", 130, 500, 1360, 250)
d.box("<b>Hết hạn</b><br>Quá ngày hết hạn thì tự được tính là hết hạn (không lưu thêm gì trong contract). Trạng thái gốc vẫn giữ nguyên.",
      150, 546, 420, 170, YELLOW, 14)
d.box("<b>Thu hồi</b><br>Admin thu hồi từng lô khi có sự cố. Là cờ riêng, áp dụng cả lô đã Sold, không xóa lịch sử.",
      600, 546, 420, 170, RED, 14)
d.box("<b>Khi bị khóa</b><br>Không bàn giao, không nhận, không ghi nhiệt độ, không bán thêm.<br>"
      "Vẫn báo sự cố và thu hồi được; từ chối / hủy yêu cầu cũ vẫn được.", 1050, 546, 420, 170, WHITE, 14)
done(d, "02-nghiep-vu.drawio")

# ================= 04 Transfer sequence =================
d = D("Bàn giao hai bước", "Bàn giao hai bước có xác minh hồ sơ")
sequence(d, [
    ("snd", "<b>Bên gửi</b><br>Farmer / Logistics", GREY),
    ("ct", "<b>FoodTraceability</b><br>(Sepolia)", GREEN),
    ("app", "<b>DApp</b> (phía bên nhận)", BLUE),
    ("ipfs", "<b>IPFS</b>", PURPLE),
    ("rcv", "<b>Bên nhận</b><br>Logistics / Retailer", GREY),
], [
    ("snd", "ct", "requestTransfer(tokenId, to)"),
    ("ct", "snd", "TransferRequested(requestId) — owner chưa đổi", "reply"),
    ("rcv", "app", "mở yêu cầu đang chờ"),
    ("app", "ct", "đọc tokenURI, 3 hash đã lưu, getPendingTransfer"),
    ("app", "ipfs", "tải nguyên byte metadata.json"),
    ("note", "SHA-256 (crypto.subtle) → so metadataHash trước khi tin nội dung JSON", "app", "ipfs"),
    ("app", "ipfs", "tải certificate.pdf, batch.jpg theo CID trong JSON → tính SHA-256 trên byte gốc"),
    ("note", "Hash sai hoặc lỗi tải → khóa nút nhận, cho phép tải lại", "app", "ipfs"),
    ("rcv", "ct", "acceptTransfer(tokenId, requestId, computedHashes) — ký bằng ví"),
    ("note", "Kiểm: đúng người nhận + vai trò, requestId active, không Sold/expired/recalled, 3 hash khớp. Sai hash → revert HashMismatch", "ct", "rcv"),
    ("note", "Đóng pending → cập nhật lifecycle → _safeTransfer", "ct", "app"),
    ("ct", "rcv", "TransferAccepted + Transfer; receipt thành công", "reply"),
    ("app", "ct", "đọc lại ownerOf, lifecycle → cập nhật timeline"),
])
done(d, "03-sequence.drawio")

# ================= 05 Auth sequence =================
d = D("Đăng nhập bằng chữ ký ví", "Đăng nhập bằng chữ ký ví, chống phát lại")
sequence(d, [
    ("w", "<b>Người dùng</b><br>MetaMask", GREY),
    ("app", "<b>DApp</b>", BLUE),
    ("api", "<b>FastAPI</b>", ORANGE),
    ("db", "<b>PostgreSQL</b>", GREEN),
    ("ct", "<b>Contract</b> (vai trò)", GREEN),
], [
    ("app", "api", "POST /auth/challenge {wallet}"),
    ("api", "db", "INSERT auth_nonces (nonce, domain, chainId, hết hạn 5 phút)"),
    ("api", "app", "thông điệp: mục đích, nonce, domain, chainId, issuedAt, expirationTime", "reply"),
    ("app", "w", "yêu cầu ký (personal_sign)"),
    ("w", "app", "signature", "reply"),
    ("app", "api", "POST /auth/verify {wallet, nonce, signature}"),
    ("note", "Backend dựng lại thông điệp từ các cột đã lưu (client không gửi message), recover_message → so với địa chỉ ví", "api", "db"),
    ("api", "db", "UPDATE auth_nonces SET used_at = now() WHERE nonce = ? AND used_at IS NULL AND expires_at > now()"),
    ("note", "0 dòng cập nhật → từ chối (replay / hết hạn / hai request đồng thời)", "api", "db"),
    ("api", "db", "INSERT sessions (token_hash, hết hạn 20 phút)"),
    ("api", "app", "access token (giữ trong bộ nhớ, bản sao ở sessionStorage để sống qua F5; không dùng localStorage)", "reply"),
    ("app", "ct", "hasRole(...) cho từng vai trò — DApp đọc vai trò của ví trực tiếp từ contract"),
    ("app", "api", "GET /documents/{id}/content — Authorization: Bearer"),
    ("api", "ct", "hasRole(...) — kiểm lại vai trò on-chain mỗi lần đọc"),
    ("api", "db", "kiểm phiên + document_grants"),
    ("api", "app", "file đã giải mã (hoặc 403)", "reply"),
    ("app", "api", "POST /auth/logout (Bearer) — đăng xuất"),
    ("api", "db", "đặt sessions.revoked_at; DApp xóa token và ngắt quyền ví"),
])
done(d, "03-sequence.drawio")

# ================= 06 ERD =================
d = D("ERD PostgreSQL", "ERD PostgreSQL — không có bảng tài khoản, không cache event")
TBL = "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;"
CELL = ("rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;"
        "fontFamily=Helvetica;fontSize=14;" + INK)
HEAD = CELL.replace("strokeWidth=1;", "strokeWidth=1.5;") + "fontStyle=1;fontSize=15;align=center;"
KEYC = CELL + "fontStyle=1;align=center;"
FLD = CELL + "align=left;spacingLeft=6;"
IDXC = CELL + "fontStyle=2;align=left;spacingLeft=6;fontSize=12;"
ER_FK = "startArrow=ERmandOne;endArrow=ERzeroToMany;startFill=0;endFill=0;"
ER_LOGIC = "startArrow=ERone;endArrow=ERzeroToMany;startFill=0;endFill=0;"


def er_table(d, name, x, y, w, rows, idx=None):
    hh, rh, ih = 36, 28, 28
    total = hh + rh * len(rows) + (ih if idx else 0)
    cont = d.vertex("zone", "", x, y, w, total, TBL, bg=True)
    d.box(name, x, y, w, hh, HEAD, 15)
    for i, (key, fld) in enumerate(rows):
        yy = y + hh + i * rh
        d.box(key, x, yy, 76, rh, KEYC, 14)
        d.box(fld, x + 76, yy, w - 76, rh, FLD, 14)
    if idx:
        d.box(idx, x, y + hh + rh * len(rows), w, ih, IDXC, 12)
    return cont


t_n = er_table(d, "auth_nonces", 40, 70, 340, [
    ("PK", "id : uuid"), ("", "wallet : char(42)"), ("UQ", "nonce : text"), ("", "domain : text"),
    ("", "chain_id : bigint"), ("", "issued_at : timestamptz"), ("", "expires_at : timestamptz"),
    ("", "used_at : timestamptz NULL")])
t_s = er_table(d, "sessions", 40, 360, 340, [
    ("PK", "id : uuid"), ("", "wallet : char(42)"), ("UQ", "token_hash : bytea"), ("", "created_at : timestamptz"),
    ("", "expires_at : timestamptz"), ("", "revoked_at : timestamptz NULL")])
t_d = er_table(d, "documents", 760, 70, 340, [
    ("PK", "id : uuid"), ("", "uploader : char(42)"), ("", "token_id : numeric(78,0) NULL"), ("", "bind_tx_hash : char(66) NULL"),
    ("", "visibility : text (CHECK)"), ("", "doc_type : text (CHECK)"), ("", "cid : text"), ("", "sha256 : bytea"),
    ("", "mime_type : text"), ("", "size_bytes : bigint"), ("", "schema_version : int"), ("", "aad : bytea NULL"),
    ("", "wrapped_key : bytea NULL"), ("", "wrap_iv : bytea NULL"), ("", "wrap_tag : bytea NULL"),
    ("", "created_at : timestamptz")])
t_g = er_table(d, "document_grants", 1260, 70, 340, [
    ("PK, FK", "document_id : uuid"), ("PK", "wallet : char(42)"), ("", "granted_by : char(42)"),
    ("", "granted_at : timestamptz"), ("", "revoked_at : timestamptz NULL")])
wal = d.box("<b>Ví (địa chỉ on-chain)</b><br>không có bảng; vai trò đọc từ contract", 470, 250, 220, 110,
            WHITE + "dashed=1;dashPattern=6 3;", 14)
# real FK: documents 1 — N document_grants
d.edge(t_d, t_g, (1100, 130), (1260, 130), extra=ER_FK)
# logical links by wallet address (dashed, no FK because there is no account table)
d.edge(wal, t_n, (470, 275), (380, 200), via=[(425, 275), (425, 200)], dashed=True, extra=ER_LOGIC)
d.edge(wal, t_s, (470, 320), (380, 470), via=[(430, 320), (430, 470)], dashed=True, extra=ER_LOGIC)
d.edge(wal, t_d, (690, 275), (760, 275), dashed=True, extra=ER_LOGIC)
d.edge(wal, t_g, (580, 360), (1420, 246), via=[(580, 625), (1420, 625)], dashed=True, extra=ER_LOGIC)
done(d, "04-data-model.drawio")
