import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))
from dfw import *  # noqa



ACTOR = ("shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;"
         "fontFamily=Helvetica;fontSize=15;" + INK + "fillColor=#ffffff;strokeColor=#333333;strokeWidth=1.5;")

# ================= 07 Use case =================
d = D("Use case", "Use case theo vai trò")
left = [
    ("Admin", BLUE, ["Cấp / thu hồi vai trò, gán farmId", "Xem xét sự cố, truy ngược lô liên quan",
                     "Thu hồi từng lô có lý do"]),
    ("Farmer", GREEN, ["Tạo lô và mint NFT", "Upload hồ sơ công khai và hóa đơn riêng",
                       "Đề nghị bàn giao cho Logistics", "Cấp quyền đọc hóa đơn cho ví khác"]),
    ("Logistics", YELLOW, ["Tiếp nhận lô từ Farmer, xác minh hồ sơ", "Từ chối yêu cầu / hủy yêu cầu đã gửi", "Ghi nhiệt độ, vị trí khi vận chuyển",
                           "Đề nghị bàn giao cho Retailer"]),
    ("Retailer", ORANGE, ["Kiểm hồ sơ (SHA-256) và nhận hàng", "Ghi nhận bán hết nguyên lô",
                          "Báo sự cố kèm bằng chứng IPFS", "Đọc hóa đơn giá mua sỉ"]),
]
right = [
    ("Consumer", PURPLE, ["Tra cứu lô bằng mã lô hoặc QR", "Xem lịch sử sở hữu và timeline kèm txHash",
                          "Xem chứng chỉ gốc và ảnh lô trên IPFS", "Xem cảnh báo nhiệt độ / thu hồi"]),
    ("IoT Simulator", GREY, ["Gửi nhiệt độ, vị trí lên chain bằng ví Logistics"]),
]
UW, UH, GAP, BGAP = 340, 58, 14, 36
zone = d.vertex("zone", "Hệ thống Food Traceability (DApp + Contract + Backend)", 215, 58, 880, 1000, ZONE.replace("rounded=1", "rounded=0"), bg=True)
y = 100
for name, sty, ucs in left:
    bh = len(ucs) * UH + (len(ucs) - 1) * GAP
    mid = y + bh / 2
    a = d.vertex("box", "", 70, mid - 35, 40, 60, ACTOR); d.text(name, 30, mid + 30, 100, 24, TEXT, 14)
    for i, u in enumerate(ucs):
        uy = y + i * (UH + GAP)
        e = d.ellipse(u, 250, uy, UW, UH, sty)
        d.edge(a, e, (110, mid - 5), (250, uy + UH / 2))
    y += bh + BGAP
bottom_left = y
y = 100
for name, sty, ucs in right:
    bh = len(ucs) * UH + (len(ucs) - 1) * GAP
    mid = y + bh / 2
    a = d.vertex("box", "", 1140, mid - 35, 40, 60, ACTOR); d.text(name, 1190, mid - 12, 150, 24, TEXTL, 14)
    for i, u in enumerate(ucs):
        uy = y + i * (UH + GAP)
        e = d.ellipse(u, 690, uy, UW, UH, sty)
        d.edge(a, e, (1140, mid - 5), (690 + UW, uy + UH / 2))
    y += bh + BGAP
zone_c = d.get(zone)
zone_c["h"] = bottom_left - 58
done(d, "02-nghiep-vu.drawio")

# ================= 08 Create batch: upload -> mint -> bind =================
d = D("Tạo lô", "Tạo lô: upload hồ sơ → createBatch (mint) → bind tài liệu")
sequence(d, [
    ("fa", "<b>Farmer</b><br>MetaMask", GREY),
    ("app", "<b>DApp</b>", BLUE),
    ("api", "<b>Backend</b><br>FastAPI", ORANGE),
    ("pin", "<b>Pinata</b><br>IPFS", PURPLE),
    ("db", "<b>PostgreSQL</b>", GREEN),
    ("ct", "<b>Contract</b><br>(Sepolia)", GREEN),
], [
    ("note", "Tiền điều kiện: Farmer đã đăng nhập bằng chữ ký ví (Bearer token) và được Admin gán FARMER_ROLE + farmId", "fa", "api"),
    ("fa", "app", "nhập thông tin lô; chọn certificate.pdf và batch.jpg (form cố định 1 tấn = 1.000 kg)"),
    ("app", "api", "POST /documents (Bearer) — file PDF / ảnh"),
    ("note", "Giới hạn ~10 MB/file, kiểm loại nội dung và quyền uploader. Tính SHA-256 trên byte gốc trước khi upload", "api", "pin"),
    ("api", "pin", "upload (network = public) → CID"),
    ("api", "db", "tạo bản ghi documents ở trạng thái draft"),
    ("api", "app", "CID + sha256 của từng file (DApp so với SHA-256 tự tính, lệch thì dừng)", "reply"),
    ("note", "DApp tạo metadata.json tham chiếu hai CID + hash, giữ nguyên một chuỗi byte, upload qua POST /documents; backend tính SHA-256 trên byte nhận được và trả metadataCID + hash để DApp đối chiếu. "
             "(đã chốt 21/10/2026)", "app", "pin"),
    ("fa", "ct", "createBatch(thông tin lô, metadataCID, 3 hash) — ký bằng MetaMask"),
    ("note", "Kiểm FARMER_ROLE + farmId, mã lô duy nhất, quantityKg = 1000, harvestDate ≤ now < expiryDate. Mint NFT + set tokenURI = ipfs://metadataCID trong cùng giao dịch", "ct", "fa"),
    ("ct", "app", "receipt + BatchCreated (tokenId)", "reply"),
    ("app", "api", "POST /documents/{id}/bind {token_id, tx_hash} — thử lại vài lần nếu backend chưa thấy receipt"),
    ("api", "ct", "đọc receipt, kiểm BatchCreated khớp uploader, tokenId, CID, hash"),
    ("api", "db", "gắn token_id nguyên tử (bind lặp: cùng kết quả; bind sang lô khác: chặn)"),
    ("api", "app", "thành công", "reply"),
    ("app", "fa", "hiện tokenId, tokenURI và mã QR", "reply"),
    ("note", "Hóa đơn riêng: mã hóa AES-256-GCM trước khi upload (Pinata chỉ nhận ciphertext); data key bọc bằng MASTER_KEY, lưu ở documents. Sau mint, bind hóa đơn chỉ cần token_id (không cần txHash)", "api", "pin"),
], gap=230, aw=170)
done(d, "03-sequence.drawio")

# ================= 09 Incident, traceback, recall =================
d = D("Sự cố và thu hồi", "Báo sự cố, truy ngược và thu hồi")
sequence(d, [
    ("rt", "<b>Retailer</b>", GREY),
    ("app", "<b>DApp</b>", BLUE),
    ("api", "<b>Backend / IPFS</b>", ORANGE),
    ("ct", "<b>Contract</b><br>(Sepolia)", GREEN),
    ("ad", "<b>Admin</b>", GREY),
], [
    ("rt", "app", "mở COCONUT-001 (Delivered hoặc Sold), chọn Báo cáo sự cố, nhập mô tả"),
    ("app", "api", "upload báo cáo JSON/PDF mẫu → reportCID, reportHash"),
    ("api", "app", "reportCID + reportHash", "reply"),
    ("rt", "ct", "reportIncident(tokenId, reportCID, reportHash) — ký bằng MetaMask"),
    ("note", "Retailer đang giữ lô; Delivered hoặc Sold → ghi IncidentReported(incidentId)", "ct", "rt"),
    ("ad", "app", "mở trang sự cố, chọn incident"),
    ("app", "ct", "đọc Transfer, TransitRecorded, BatchCreated → truy ngược Farmer, farmId, harvestGroupId"),
    ("note", "Tìm lô cùng farmId + harvestGroupId (ngoài chuỗi): COCONUT-002 → đưa vào diện xem xét. "
             "COCONUT-003 (khác nhóm) và COCONUT-004 (khác trang trại) không tự bị thu hồi. "
             "Đây là danh sách xem xét, chưa phải kết luận nhiễm khuẩn", "app", "ct"),
    ("ad", "ct", "recallBatch(tokenId, incidentId, reasonCID/hash) — từng lô, có lý do"),
    ("note", "Kiểm Admin, lô tồn tại, chưa thu hồi, incidentId đã ghi (có thể thuộc lô khác)", "ct", "ad"),
    ("ct", "ad", "BatchRecalled; recalled = true", "reply"),
    ("note", "QR hiện cảnh báo kể cả khi Sold; request / accept / recordTransit / markSold mới bị chặn. "
             "Pending còn tồn: accept bị chặn, người gửi được cancel", "ct", "rt"),
], gap=270, aw=180)
done(d, "03-sequence.drawio")

# ================= 10 IoT flow =================
d = D("IoT simulator", "Simulator ghi nhiệt độ lên chain")
sequence(d, [
    ("csv", "<b>readings.csv</b>", YELLOW),
    ("sim", "<b>simulate.py</b><br>Python + web3.py 7.13", YELLOW),
    ("ct", "<b>Contract</b><br>(RPC Sepolia)", GREEN),
    ("app", "<b>DApp</b>", BLUE),
], [
    ("sim", "csv", "đọc readingId, tokenId, tempCenti, observedAt, location (1250 = 12,50°C)"),
    ("note", "Kiểm RPC, chainId, contract có bytecode; ví từ private key đúng Logistics. --dry-run chỉ kiểm dữ liệu, không phát giao dịch", "csv", "ct"),
    ("sim", "ct", "kiểm ví đang giữ lô, lifecycle = InTransit (ownerOf, getBatch)"),
    ("sim", "ct", "build_transaction recordTransit(...) — nonce pending, ước lượng gas"),
        ("note", "Contract kiểm: Logistics đang giữ, InTransit, readingId chưa dùng, observedAt ≤ now và không lùi", "sim", "ct"),
    ("ct", "sim", "receipt (txHash, status, gasUsed) → ghi ra CSV log", "reply"),
    ("app", "ct", "đọc event TransitRecorded"),
    ("note", "Hiển thị nhiệt độ = tempCenti ÷ 100; cảnh báo nếu ngoài 8–15°C (mẫu 18°C)", "ct", "app"),
    ], gap=290, aw=190)
done(d, "03-sequence.drawio")

# ================= 11 Deployment =================
d = D("Triển khai", "Sơ đồ triển khai")
d.zone("Thiết bị người dùng", 40, 80, 260, 300)
d.zone("Hosting tĩnh (HTTPS)", 380, 80, 300, 140)
d.zone("PaaS (HTTPS)", 760, 80, 320, 300)
d.zone("Dịch vụ ngoài", 1160, 80, 300, 300)
d.zone("Ethereum Sepolia (chainId 11155111)", 1160, 460, 300, 160)
d.zone("Máy phát triển (tùy chọn)", 40, 460, 1060, 150)
br = d.box("<b>Trình duyệt + MetaMask</b><br>Admin / Farmer / Logistics / Retailer / Consumer", 60, 125, 220, 90, GREY)
ph = d.box("<b>Điện thoại</b><br>camera quét QR → URL trace", 60, 260, 220, 90, GREY)
fe = d.box("<b>Frontend</b><br>bản build Vite (VITE_*)", 400, 135, 260, 70, BLUE)
be = d.box("<b>Backend</b><br>container Dockerfile · uvicorn<br>secret trong cấu hình nền tảng", 780, 125, 280, 90, ORANGE)
pgd = d.box("<b>PostgreSQL</b><br>do nền tảng cấp (1 DB)", 780, 270, 280, 80, GREEN)
rpc = d.box("<b>RPC Sepolia</b><br>Alchemy", 1180, 125, 260, 90, PURPLE)
pn = d.box("<b>Pinata</b><br>IPFS public (pin file)", 1180, 260, 260, 100, PURPLE)
ct = d.box("<b>FoodTraceability.sol</b><br>địa chỉ + deployBlock<br>lưu docs/deployments/sepolia.json", 1180, 505, 260, 100, GREEN)
hh = d.box("<b>Hardhat node</b><br>chạy / test local", 60, 510, 220, 80, YELLOW)
pgl = d.box("<b>PostgreSQL local</b><br>Docker Compose (chỉ DB)", 320, 510, 220, 80, YELLOW)
bel = d.box("<b>Backend local</b><br>uvicorn · MASTER_KEY riêng", 580, 510, 220, 80, YELLOW)
iot = d.box("<b>iot/simulate.py</b><br>ví Logistics ký", 840, 495, 240, 90, YELLOW)
d.edge(br, fe, (280, 170), (400, 170))
d.elabel("tải app", 340, 150, 60)
d.edge(fe, be, (660, 170), (780, 170))
d.elabel("gọi API", 720, 150, 60)
d.edge(be, rpc, (1060, 170), (1180, 170))
d.elabel("đọc chain", 1120, 150, 70)
d.edge(be, pgd, (920, 215), (920, 270))
d.elabel("SQL", 930, 243, 40, align="l")
d.edge(be, pn, (1060, 200), (1180, 310), via=[(1110, 200), (1110, 310)])
d.edge(ph, fe, (280, 305), (530, 205), via=[(530, 305)])
d.elabel("quét QR → mở trang trace", 300, 285, 170, align="l")
d.edge(br, rpc, (170, 125), (1310, 125), via=[(170, 50), (1310, 50)])
d.elabel("MetaMask ký tx · trang trace đọc trực tiếp RPC / IPFS", 900, 32, 520)
d.edge(rpc, ct, (1440, 170), (1440, 540), via=[(1485, 170), (1485, 540)])
d.elabel("JSON-RPC", 1490, 350, 70, align="l")
d.edge(iot, ct, (1080, 540), (1180, 540))
d.elabel("recordTransit", 1130, 520, 80)
d.edge(bel, pgl, (580, 550), (540, 550))
done(d, "01-architecture.drawio")

# ================= 12 Data placement =================
d = D("Dữ liệu lưu ở đâu", "Dữ liệu lưu ở đâu: on-chain · IPFS · PostgreSQL")
d.box("<b>On-chain (Sepolia)</b><hr>• mã lô, farmId, harvestGroupId, farmLocation<br>• ngày thu hoạch / hết hạn, quantityKg = 1000<br>"
      "• chủ hiện tại (ownerOf), lifecycle, cờ recalled<br>• 3 hash SHA-256 + metadataCID (tokenURI = ipfs://CID)<br>"
      "• bàn giao đang chờ, sự cố, quyết định thu hồi<br>• vai trò (AccessControl), farmId của Farmer<br>"
      "• event dựng timeline: BatchCreated, Transfer, TransitRecorded...<br><br><b>Nguồn sự thật</b> về owner và trạng thái lô",
      40, 70, 400, None, GREEN)
d.box("<b>IPFS công khai (Pinata)</b><hr>• certificate.pdf (chứng nhận mẫu)<br>• batch.jpg (ảnh lô)<br>• metadata.json (tham chiếu 2 CID + hash)<br>"
      "• báo cáo sự cố (JSON/PDF mẫu)<br>• ciphertext hóa đơn riêng (AES-256-GCM)<br><br>"
      "CID công khai, nhưng ciphertext không đọc được nếu thiếu khóa.",
      480, 70, 400, None, PURPLE)
d.box("<b>PostgreSQL (backend)</b><hr>• auth_nonces: nonce đăng nhập, hết hạn, đã dùng<br>• sessions: hash token, hết hạn<br>"
      "• documents: CID, sha256, uploader, token_id, wrapped key<br>• document_grants: ví được đọc, thu hồi<br><br>"
      "Dữ liệu vận hành, <b>không</b> quyết định ownerOf hay trạng thái lô.",
      920, 70, 400, None, ORANGE)
d.note("<b>Không có:</b> bảng tài khoản (danh tính = địa chỉ ví, vai trò đọc từ contract) · cache event trong DB · "
       "khóa của Farmer/Retailer ở backend. Trang trace công khai đọc thẳng RPC + IPFS. "
       "Token đăng nhập chỉ nằm ở sessionStorage của trình duyệt (mất khi đóng tab), không ở DB dạng rõ (DB chỉ giữ SHA-256 của token).", 40, 470, 1280)
done(d, "01-architecture.drawio")

# ================= 13 Contract structure (theo vai trò) =================
d = D("Cấu trúc contract", "Contract FoodTraceability: mỗi vai trò làm được gì")
CW, CG, CX0 = 260, 20, 40
l1 = d.box("<b>ERC-721</b><br>mỗi lô hàng = 1 NFT, có chủ sở hữu", 40, 60, 420, 70, PURPLE)
l2 = d.box("<b>AccessControl</b><br>phân vai trò: Admin · Farmer · Logistics · Retailer", 500, 60, 440, 70, PURPLE)
l3 = d.box("<b>ReentrancyGuard</b><br>chặn gọi lặp trong cùng giao dịch", 980, 60, 420, 70, PURPLE)
core = d.box("<b>FoodTraceability</b> · contract trên Ethereum Sepolia · kế thừa ba thư viện OpenZeppelin 5.4.0", 40, 190, 1380, 60, GREEN)
for cx, lib in ((250, l1), (720, l2), (1190, l3)):
    d.edge(core, lib, (cx, 190), (cx, 130), extra="endFill=0;")
d.elabel("kế thừa", 1260, 160, 70, align="l")
cols = [
    ("Admin", BLUE, [
        ("assignFarmer", "Gán mã trang trại (farmId) cho Farmer"),
        ("grantRole / revokeRole", "Cấp hoặc thu hồi vai trò"),
        ("recallBatch", "Thu hồi một lô, kèm lý do"),
    ]),
    ("Farmer", GREEN, [
        ("createBatch", "Tạo lô 1.000 kg, mint NFT, lưu 3 hash hồ sơ"),
        ("requestTransfer", "Đề nghị bàn giao lô cho Logistics"),
        ("cancelTransfer", "Hủy đề nghị đã gửi"),
    ]),
    ("Logistics", YELLOW, [
        ("acceptTransfer", "Nhận lô từ Farmer, 3 hash phải khớp"),
        ("recordTransit", "Ghi nhiệt độ, vị trí khi vận chuyển"),
        ("requestTransfer", "Đề nghị bàn giao lô cho Retailer"),
        ("rejectTransfer", "Từ chối lô được chuyển tới"),
    ]),
    ("Retailer", ORANGE, [
        ("acceptTransfer", "Nhận lô từ Logistics, 3 hash phải khớp"),
        ("markSold", "Ghi nhận bán hết lô"),
        ("reportIncident", "Báo sự cố kèm bằng chứng"),
        ("rejectTransfer", "Từ chối lô được chuyển tới"),
    ]),
    ("Mọi người (chỉ đọc)", GREY, [
        ("getBatch · getIncident", "Xem thông tin lô, sự cố"),
        ("getPendingTransfer", "Xem yêu cầu bàn giao đang chờ"),
        ("getTokenIdByCode · isExpired", "Đổi mã lô ra tokenId; kiểm hết hạn"),
        ("ownerOf · tokenURI", "Chủ hiện tại; link hồ sơ trên IPFS"),
    ]),
]
bottoms = []
for i, (role, sty, fns) in enumerate(cols):
    x = CX0 + i * (CW + CG)
    hb = d.box(f"<b>{role}</b>", x, 330, CW, 44, sty)
    d.edge(hb, core, (x + CW / 2, 330), (x + CW / 2, 250))
    y = 384
    for fn, desc in fns:
        b = d.box(f"<b>{fn}</b><br>{desc}", x, y, CW, None, WHITE, 14)
        y += d.get(b)["h"] + 10
    bottoms.append(y)
d.elabel("gọi hàm", 46, 290, 70, align="l")
yb = max(bottoms) + 14
dz = d.zone("Dữ liệu contract lưu cho mỗi lô", 40, yb, 1380, 150)
d.edge(core, dz, (40, 220), (40, yb + 75), via=[(16, 220), (16, yb + 75)])
d.box("<b>Batch</b><br>mã lô, farmId, ngày thu hoạch / hết hạn, trạng thái, 3 hash hồ sơ", 60, yb + 46, 420, 86, GREY, 14)
d.box("<b>Bàn giao đang chờ</b><br>bên gửi, bên nhận, còn hiệu lực hay không", 500, yb + 46, 420, 86, GREY, 14)
d.box("<b>Sự cố</b><br>người báo, CID và hash báo cáo, thời điểm", 940, yb + 46, 460, 86, GREY, 14)
d.note("<b>Chặn đường vòng:</b> transferFrom, safeTransferFrom, approve, setApprovalForAll đều bị từ chối. "
       "Chủ lô chỉ đổi qua requestTransfer rồi acceptTransfer.", 40, yb + 170, 680)
d.note("Mỗi thao tác ghi đều phát event (BatchCreated, TransferAccepted, TransitRecorded, ...); trang truy xuất dựng timeline từ các event này.",
       740, yb + 170, 680)
done(d, "04-data-model.drawio")

# ================= 14 Wireframes =================
d = D("Wireframe", "Wireframe các màn hình chính")
KIND = {
    "chain": WHITE + "strokeWidth=3;", "api": WHITE + "dashed=1;dashPattern=6 3;", "read": WHITE + "dashed=1;dashPattern=1 3;strokeWidth=2;",
    "field": "rounded=0;whiteSpace=wrap;html=1;fontFamily=Helvetica;fontSize=14;" + INK + "fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;align=left;spacingLeft=8;",
}
WCONT = "rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;"


def screen(d, x, y, title, items, w=400):
    cy = y + 58
    layout = []
    for kind, label in items:
        if kind == "text":
            h = max(30, est_h(label, w - 32, 14, 10))
        else:
            h = max(34, est_h(label, w - 32, 14, 14))
        layout.append((kind, label, cy, h))
        cy += h + 10
    total = cy - y + 6
    d.vertex("zone", "", x, y, w, total, WCONT, bg=True)
    d.box(f"<b>{title}</b>", x, y, w, 48, GREY)
    for kind, label, yy, h in layout:
        if kind == "text":
            d.text(label, x + 16, yy, w - 32, h, TEXTL, 14)
        else:
            d.box(label, x + 16, yy, w - 32, h, KIND[kind], 14)
    return total


W = "Kết nối MetaMask · chainId 11155111 · vai trò: "
h1 = screen(d, 40, 90, "1. Trace công khai (Consumer, không cần ví)", [
    ("field", "Nhập batchCode / tokenId · hoặc quét QR"),
    ("read", "Tra cứu (đọc RPC)"),
    ("text", "Trạng thái: Delivered · nhãn Hết hạn · cảnh báo ⚠ Thu hồi (kể cả Sold)"),
    ("text", "Timeline: BatchCreated → TransitRecorded → IncidentReported → BatchRecalled, mỗi mốc kèm txHash + link Etherscan"),
    ("text", "Ownership history (từ Transfer): Farmer → Logistics → Retailer"),
    ("text", "Hồ sơ công khai: ảnh lô, PDF chứng nhận gốc, ipfs://CID + URL gateway"),
    ("read", "Mở PDF / ảnh (đọc IPFS)"),
    ("text", "Phân biệt: không tìm thấy · đang tải · lỗi RPC · hash không khớp"),
])
h2 = screen(d, 480, 90, "2. Farmer: tạo lô", [
    ("text", W + "Farmer"),
    ("field", "batchCode · farmId (do Admin gán) · harvestGroupId"),
    ("field", "Khối lượng: 1 tấn (1.000 kg), không cho sửa"),
    ("field", "Ngày thu hoạch · ngày hết hạn · giống · phân bón · vị trí trang trại"),
    ("api", "Upload hồ sơ: PDF, ảnh, JSON (gọi backend → IPFS)"),
    ("chain", "Tạo lô + mint NFT (createBatch)"),
    ("api", "Gắn tài liệu vào lô (bind)"),
    ("text", "Sau receipt: tokenId, tokenURI, mã QR"),
])
h3 = screen(d, 920, 90, "3. Logistics: lô đang giữ", [
    ("text", W + "Logistics"),
    ("text", "Bảng lô: yêu cầu chờ nhận · lô đang giữ"),
    ("chain", "Chấp nhận (acceptTransfer) sau khi xác minh hồ sơ"),
    ("chain", "Ghi vận chuyển (recordTransit)"),
    ("text", "Lịch sử readings; cảnh báo khi ngoài 8–15°C"),
    ("chain", "Đề nghị giao Retailer (requestTransfer)"),
    ("chain", "Từ chối / hủy yêu cầu"),
])
row2 = 90 + max(h1, h2, h3) + 50
h4 = screen(d, 40, row2, "4. Retailer: nhận hàng, bán, báo sự cố", [
    ("text", W + "Retailer"),
    ("text", "Yêu cầu bàn giao đang chờ"),
    ("text", "Xác minh hồ sơ: metadata ✔ · certificate ✔ · ảnh ✔ (SHA-256); lỗi → khóa nút nhận"),
    ("read", "Tải lại hồ sơ từ IPFS"),
    ("chain", "Xác nhận nhận hàng (acceptTransfer + 3 hash)"),
    ("chain", "Bán hết (markSold)"),
    ("api", "Upload báo cáo sự cố"),
    ("chain", "Báo sự cố (reportIncident)"),
])
h5 = screen(d, 480, row2, "5. Admin: vai trò, sự cố, thu hồi", [
    ("text", W + "Admin"),
    ("chain", "Cấp / thu hồi vai trò · gán farmId"),
    ("text", "Danh sách sự cố"),
    ("text", "Truy ngược: farmId + harvestGroupId → lô liên quan (xem xét từng lô)"),
    ("chain", "Thu hồi từng lô (recallBatch) kèm lý do"),
    ("text", "Hóa đơn riêng: Admin không có grant → 403"),
])
lg = d.vertex("zone", "", 920, row2, 400, 220, WCONT, bg=True)
d.box("<b>Chú giải</b>", 920, row2, 400, 36, GREY)
d.box("Viền đậm: ghi on-chain (MetaMask ký → RPC → contract)", 936, row2 + 46, 368, 48, KIND["chain"], 14)
d.box("Viền nét đứt: gọi API backend (Bearer token)", 936, row2 + 104, 368, 48, KIND["api"], 14)
d.box("Viền chấm: đọc RPC / IPFS (không cần đăng nhập)", 936, row2 + 162, 368, 48, KIND["read"], 14)
done(d, "05-wireframes.drawio")

# ================= 15 Screen flow (liên kết các màn hình) =================
d = D("Liên kết màn hình", "Sơ đồ liên kết các màn hình (điều hướng của ứng dụng)")
RT = '<br><font style="font-size:12px">{}</font>'
BW, BH = 210, 96          # kích thước một màn hình trong vùng vai trò
M = BH / 2                # giữa hộp theo chiều dọc
PITCH, X0, BAND_H = 290, 710, 310
ROW0, ROW1 = 52, 196      # vị trí hàng trong vùng vai trò


def scr(name, route, x, y, w=BW, h=BH, kind=None, extra=""):
    label = f"<b>{name}</b>" + RT.format(route) + (RT.format(extra) if extra else "")
    return d.box(label, x, y, w, h, KIND[kind] if kind else WHITE, 15)


# --- cột công khai
d.zone("Công khai (không cần ví)", 40, 70, 280, 700)
A1 = scr("Trang chủ", "/", 60, 130, 240, 80)
A2 = scr("Tra cứu lô", "/trace", 60, 280, 240, 100, "read", "nhập mã · quét QR (camera, ảnh)")
A3 = scr("Chi tiết lô công khai", "/trace/:chainId/:contract/:tokenId", 60, 480, 240, 130, "read", "5 tab + mã QR")
d.edge(A1, A2, (180, 210), (180, 280))
d.elabel("Tra cứu lô", 245, 245, 110)
d.edge(A2, A3, (180, 380), (180, 480))
d.elabel("mã lô · tokenId · URL của QR", 252, 430, 120)
d.note("Mọi trang quản lý có liên kết sang /trace. Chi tiết lô và Biên nhận của Farmer mở trang công khai hoặc quét QR của lô.", 60, 640, 240)

# --- cột đăng nhập
d.zone("Đăng nhập bằng ví", 350, 70, 280, 700)
B1 = scr("Kết nối ví", "/connect", 370, 130, 240, 80)
B2 = scr("Sai mạng", "/auth/network", 470, 280, 140, 90)
B3 = scr("Ký thông điệp", "/auth/sign", 370, 440, 240, 130, "api", "đọc vai trò (hasRole) → vào trang vai trò")
B4 = scr("Chưa được cấp quyền", "/auth/no-access", 370, 630, 240, 80)
d.edge(A1, B1, (300, 170), (370, 170))
d.edge(B1, B2, (540, 210), (540, 280))
d.elabel("sai mạng", 548, 245, 80, align="l")
d.edge(B2, B3, (540, 370), (540, 440))
d.elabel("đã đổi mạng", 548, 405, 82, align="l")
d.edge(B1, B3, (392, 210), (392, 440))
d.elabel("đúng mạng", 432, 330, 75)
d.edge(B3, B4, (490, 570), (490, 630))
d.elabel("chưa có vai trò", 498, 600, 120, align="l")
d.note("Đăng xuất hoặc đổi ví → về Kết nối ví. Đang đăng nhập mà đổi mạng → Sai mạng. F5 giữ phiên nếu ví vẫn đúng tài khoản.", 370, 730, 240)


# --- các vùng vai trò
def col(c):
    return X0 + PITCH * c


def band(title, by):
    d.zone(title, 690, by, 1400, BAND_H)
    return by + ROW0, by + ROW1


def h_edge(a, b, c_from, c_to, y, label, lines=2):
    """Mũi tên ngang giữa hai màn cùng hàng; nhãn đặt phía trên mũi tên, trong khoảng trống giữa hai cột."""
    d.edge(a, b, (col(c_from) + BW, y + M), (col(c_to), y + M))
    gap_cx = col(c_from) + BW + (PITCH - BW) / 2
    d.elabel(label, gap_cx, y + M - (34 if lines == 2 else 22), PITCH - BW - 4)


def v_edge(a, b, c, y_top, y_bottom, label, w=130):
    d.edge(a, b, (col(c) + BW / 2, y_top + BH), (col(c) + BW / 2, y_bottom))
    d.elabel(label, col(c) + BW / 2 + 10, y_top + BH + (y_bottom - y_top - BH) / 2, w, align="l")


bands = {}
# Farmer
r0, r1 = band("Farmer · /farmer/*  (menu trái: Tổng quan · Lô của tôi · Tạo lô NFT · Chuyển giao)", 70)
F1 = scr("Tổng quan", "/farmer/overview", col(0), r0)
F2 = scr("Lô của tôi", "/farmer/batches", col(1), r0)
F3 = scr("Chi tiết lô", "/farmer/batches/:code", col(2), r0, BW, BH, None, "6 tab")
F4 = scr("Chuyển giao", "/farmer/transfers", col(3), r0, BW, BH, "chain", "requestTransfer / hủy")
F5 = scr("Tạo lô NFT", "/farmer/create", col(0), r1, BW, BH, "chain", "5 bước, createBatch")
F6 = scr("Biên nhận + QR", "bước cuối của Tạo lô", col(1), r1)
bands["Farmer"] = (F1, r0)
h_edge(F1, F2, 0, 1, r0, "menu", 1)
h_edge(F2, F3, 1, 2, r0, "bấm một lô")
h_edge(F3, F4, 2, 3, r0, "yêu cầu chuyển")
v_edge(F1, F5, 0, r0, r1, "Tạo lô NFT mới")
h_edge(F5, F6, 0, 1, r1, "ký và mint")
d.edge(F6, F3, (col(1) + BW, r1 + M), (col(2) + BW / 2, r0 + BH), via=[(col(2) + BW / 2, r1 + M)])
d.elabel("xem chi tiết lô", col(1) + BW + 95, r1 + M - 22, 170)

# Logistics
r0, r1 = band("Logistics · /logistics/*  (menu trái: Tổng quan · Chờ nhận · Lô đang giữ · Bàn giao đi)", 400)
L1 = scr("Tổng quan", "/logistics/overview", col(0), r0)
L2 = scr("Chờ nhận", "/logistics/incoming", col(1), r0, BW, BH, "chain", "acceptTransfer / từ chối")
L3 = scr("Lô đang giữ", "/logistics/batches", col(2), r0)
L4 = scr("Chi tiết lô", "/logistics/batches/:code", col(3), r0, BW, BH, "chain", "recordTransit")
L5 = scr("Bàn giao đi", "/logistics/outgoing", col(3), r1, BW, BH, "chain", "requestTransfer / hủy")
bands["Logistics"] = (L1, r0)
h_edge(L1, L2, 0, 1, r0, "menu", 1)
h_edge(L2, L3, 1, 2, r0, "đã nhận", 1)
h_edge(L3, L4, 2, 3, r0, "bấm một lô")
v_edge(L4, L5, 3, r0, r1, "đề nghị giao Retailer", 170)

# Retailer
r0, r1 = band("Retailer · /retailer/*  (menu trái: Tổng quan · Chờ nhận · Lô đang giữ · Bán hết · Báo sự cố)", 730)
R1 = scr("Tổng quan", "/retailer/overview", col(0), r0)
R2 = scr("Chờ nhận", "/retailer/incoming", col(1), r0, BW, BH, "chain", "acceptTransfer + 3 hash")
R3 = scr("Lô đang giữ", "/retailer/batches", col(2), r0)
R4 = scr("Chi tiết lô", "/retailer/batches/:code", col(3), r0)
R5 = scr("Bán hết", "/retailer/sales", col(4), r0, BW, BH, "chain", "markSold")
R6 = scr("Báo sự cố mới", "/retailer/incidents/new", col(3), r1, BW, BH, "chain", "reportIncident")
bands["Retailer"] = (R1, r0)
h_edge(R1, R2, 0, 1, r0, "menu", 1)
h_edge(R2, R3, 1, 2, r0, "đã nhận", 1)
h_edge(R3, R4, 2, 3, r0, "bấm một lô")
h_edge(R4, R5, 3, 4, r0, "bán hết lô")
v_edge(R4, R6, 3, r0, r1, "phát hiện sự cố", 150)

# Admin
r0, r1 = band("Admin · /admin/*  (menu trái: Tổng quan · Vai trò · Trang trại · Sự cố · Lô)", 1060)
M1 = scr("Tổng quan", "/admin/overview", col(0), r0)
M2 = scr("Vai trò", "/admin/roles", col(1), r0, BW, BH, "chain", "cấp / thu hồi vai trò")
M3 = scr("Trang trại", "/admin/farms", col(2), r0, BW, BH, "chain", "gán farmId")
M4 = scr("Sự cố", "/admin/incidents", col(0), r1)
M5 = scr("Chi tiết sự cố", "/admin/incidents/:id", col(1), r1, BW, BH, "chain", "recallBatch")
M6 = scr("Lô", "/admin/batches", col(2), r1)
M7 = scr("Chi tiết lô", "/admin/batches/:code", col(3), r1, BW, BH, "chain", "recallBatch")
bands["Admin"] = (M1, r0)
h_edge(M1, M2, 0, 1, r0, "menu", 1)
v_edge(M1, M4, 0, r0, r1, "menu", 70)
h_edge(M4, M5, 0, 1, r1, "bấm sự cố")
h_edge(M5, M6, 1, 2, r1, "lô liên quan")
h_edge(M6, M7, 2, 3, r1, "bấm một lô")

# --- từ Ký thông điệp vào trang của từng vai trò
for name, (first, ty) in bands.items():
    d.edge(B3, first, (610, 505), (col(0), ty + M), via=[(650, 505), (650, ty + M)])

# --- chú giải
d.zone("Chú giải", 40, 840, 590, 350)
d.box("Viền đậm: màn có thao tác ghi on-chain (MetaMask ký → RPC → contract)", 60, 880, 550, 56, KIND["chain"], 14)
d.box("Viền nét đứt: màn gọi API backend (Bearer token)", 60, 946, 550, 56, KIND["api"], 14)
d.box("Viền chấm: màn chỉ đọc RPC / IPFS (không cần đăng nhập)", 60, 1012, 550, 56, KIND["read"], 14)
d.note("Mũi tên: điều hướng, nhãn là hành động của người dùng. Nhãn menu: chuyển bằng menu bên trái của dashboard. "
       "Bốn vai trò dùng chung khung dashboard; trang Chi tiết lô của mỗi vai trò khác nhau.", 60, 1090, 550)
done(d, "05-wireframes.drawio")
