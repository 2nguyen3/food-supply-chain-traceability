# CODE.md — Việc code Food Traceability

Danh sách việc code duy nhất của dự án, **giữ nguyên mã việc P/OP**. Chỉ gồm việc code, cấu hình và chạy thật. Không gồm: GĐ01; việc thiết kế và tài liệu của GĐ02 (P02-01 đến 04, 08, 09, 12, 17, 18, 20); GĐ08 (báo cáo, slide, video, demo); P03-01; P06-01 (gộp vào P07-02); P07-07; P07-08. Trạng thái tick cập nhật 08/11/2026 theo phần đã chạy thật (Farmer, đăng nhập ví, trang trace công khai).

Đặc tả: `docs/notes/` (`contract-spec`, `api-spec`, `db-schema`, `requirements`, `test-cases`). Bản đọc cho người: `docs/Code_Spec.docx`.

## Quy tắc

1. Làm theo thứ tự giai đoạn. Việc **Tùy chọn** chỉ làm khi luồng chính đã ổn.
2. Mỗi việc một mã; nhắc mã trong commit và PR.
3. Chỉ người dùng tick `[x]`, khi code đã chạy thật (test xanh hoặc có tx hash). Claude không tick.
4. Việc đang làm dở thì thêm `(đang làm)` cuối dòng. Không đổi mã việc; việc phát sinh thì thêm dòng mới với mã kế tiếp.
5. Không tạo tài liệu, evidence, test hay script ngoài danh sách. Test chỉ viết cho ca C/I trong `test-cases.md`. Code thử xong không dùng thì xóa.
6. Phụ trách: A = contract, B = backend, C = frontend luồng chính, D = trang trace/QR, Admin, truy ngược, IoT, dữ liệu mẫu.
7. Việc theo vai trò: `ROLE-LOGISTICS.md`, `ROLE-RETAILER.md`, `ROLE-ADMIN.md` (cùng thư mục). Các file này chỉ tham chiếu mã việc ở đây, ô tick chỉ đổi trong `CODE.md`.

## GĐ02. Thiết kế và môi trường

### Chung

- [ ] `P02-05` Cài Git, Node 22, Python 3.12, VS Code (Docker tùy chọn) (đang làm) — Phụ trách: Cả nhóm · Đầu ra: Chạy được node, python, git
- [ ] `P02-06` Kiểm tra repo: README, .gitignore, .env.example và 5 thư mục — Phụ trách: D · Đầu ra: Repo chạy được, không có secret
- [ ] `P02-10` Tạo 5 ví testnet (Admin, Farmer A, Farmer B, Logistics, Retailer) — Phụ trách: D · Đầu ra: Manifest địa chỉ công khai
- [ ] `P02-11` Soạn bộ hồ sơ mẫu: certificate.pdf, batch.jpg, metadata.json, hóa đơn mẫu — Phụ trách: D · Đầu ra: 3 loại dữ liệu, đánh dấu là mẫu

### Contract

- [ ] `P02-13` Chốt quy ước lô: 1 lô = 1 tấn (quantityKg = 1000) cho mọi lô demo; metadata và seed_demo.py cùng ghi 1000 (đang làm) — Phụ trách: nini · Đầu ra: Ghi vào design.md
- [X] `P02-14` Khởi tạo Hardhat 3, OpenZeppelin 5.4.0, compiler 0.8.28; chạy test mẫu — Phụ trách: A · Đầu ra: Test mẫu xanh

### BE

- [X] `P02-15` Tạo venv, cài thư viện backend; chạy được /health — Phụ trách: B · Đầu ra: requirements.lock
- [X] `P02-16` Dựng PostgreSQL cục bộ bằng Docker Compose: một container, hai database riêng `food_dev` (chạy backend) và `food_test` (pytest), mỗi database một role riêng; đặt DATABASE_URL và TEST_DATABASE_URL; khởi tạo Alembic — Phụ trách: ntn · Đầu ra: alembic upgrade head chạy được trên food_dev; role dev và role test không vào được database của nhau

### FE

- [X] `P02-19` Tạo dự án Vite + React 19 + TS; cài ethers, qrcode.react, recharts — Phụ trách: nini · Đầu ra: Trang mẫu chạy được

### IoT

- [ ] `P02-21` Tạo venv, cài web3.py 7.13.0, python-dotenv — Phụ trách: D · Đầu ra: Import Web3 được; có requirements.lock
- [ ] `P02-22` Chốt định dạng readings.csv và bộ 5 mẫu (10, 12, 18, 13, 11°C; ngưỡng 8–15°C) — Phụ trách: D · Đầu ra: readingId, tokenId, tempCenti, observedAt, location

## GĐ03. Contract

### Contract

- [X] `P03-02` Tạo FoodTraceability: ERC721URIStorage + AccessControl + ReentrancyGuard — Phụ trách: A · Đầu ra: Compile được; supportsInterface đúng
- [X] `P03-03` Viết roles; gán Farmer/farmId (danh sách Trusted Farmers); cấp/thu hồi vai trò — Phụ trách: ntn · Đầu ra: Có event cấp/thu hồi
- [X] `P03-04` Viết createBatch (harvestProduct): ngày thu hoạch, vị trí trang trại, kiểm quantityKg == 1000, mint, tokenURI, 3 hash — Phụ trách: ntn · Đầu ra: Mint, URI, hash trong một giao dịch
- [X] `P03-05` Viết getBatch, getPendingTransfer, isExpired (hết hạn từ block.timestamp) còn thiếu — Phụ trách: ntn · Đầu ra: Read methods đủ cho UI
- [X] `P03-06` Viết request/accept/reject/cancel bàn giao — Phụ trách: ntn · Đầu ra: Request chưa đổi chủ
- [X] `P03-07` Viết acceptTransfer (receiveAndVerify): kiểm 3 hash, lỗi HashMismatch — Phụ trách: ntn · Đầu ra: Sai một hash thì revert
- [X] `P03-08` Viết recordTransit (updateTransitStatus): vị trí, nhiệt độ, readingId — Phụ trách: ntn · Đầu ra: Chặn sai chủ, trùng readingId
- [X] `P03-09` Viết markSold; ràng buộc Sold không cập nhật thêm vận chuyển — Phụ trách: ntn · Đầu ra: Gọi lại bị chặn
- [X] `P03-10` Viết reportIncident và recallBatch (kiểm incidentId tồn tại) — Phụ trách: ntn · Đầu ra: Thu hồi được cả lô Sold
- [X] `P03-11` Chặn transferFrom, safeTransferFrom, approve ngoài nghiệp vụ; nonReentrant — Phụ trách: ntn · Đầu ra: Có test chứng minh
- [X] `P03-12` Viết test C01–C03: tạo lô 1.000 kg, quyền, quantityKg khác 1000 (0, 999, 1001), ngày sai — Phụ trách: ntn · Đầu ra: Test xanh
- [X] `P03-13` Viết test C04–C10: bàn giao, hash, request cũ, role bị thu hồi — Phụ trách: ntn · Đầu ra: Test xanh
- [X] `P03-14` Viết test C11–C12: chặn chuyển trực tiếp, callback/reentrancy — Phụ trách: ntn · Đầu ra: Test xanh
- [X] `P03-15` Viết test C13–C18: recordTransit, markSold, expired/recalled/Sold, sự cố, tokenURI — Phụ trách: ntn · Đầu ra: Test xanh
- [X] `P03-16` Viết Ignition module; export ABI, address, deployBlock; gửi ABI cho B, C, D — Phụ trách: ntn · Đầu ra: ABI dùng chung ba phía
- [X] `P03-17` Chạy local: mint → 2 lần bàn giao → Sold bằng script smoke test — Phụ trách: ntn · Đầu ra: Log chạy thành công

### BE

- [X] `P03-18` Dựng khung FastAPI, config, models SQLAlchemy, migration đầu (revision 0002, sau baseline 0001) tạo 4 bảng theo ERD — Phụ trách: ntn · Đầu ra: App khởi động, kết nối database food_dev; alembic upgrade head tạo đủ 4 bảng
- [X] `P03-19` Viết chain.py đọc contract bằng ABI nháp (kiểm vai trò, chủ lô) — Phụ trách: ntn · Đầu ra: Kiểm được vai trò từ contract

### FE

- [x] `P03-20` Kết nối MetaMask: kiểm chainId, hiện ví và vai trò, xử lý accountsChanged/chainChanged — Phụ trách: C · Đầu ra: Đổi ví thì xóa dữ liệu phiên cũ
- [x] `P03-21` Dựng luồng giao dịch: kiểm input → ký → txHash → receipt → thành công/lỗi — Phụ trách: C · Đầu ra: Phân biệt từ chối ký và revert

## GĐ04. IPFS và bảo mật

### BE

- [X] `P04-01` Tạo tài khoản Pinata, JWT; upload network=public — Phụ trách: ntn · Đầu ra: Trả về CID
- [X] `P04-02` Giới hạn upload 10 MB, kiểm loại nội dung và quyền uploader — Phụ trách: ntn · Đầu ra: Không tin duy nhất extension
- [X] `P04-03` Tạo metadata JSON (lưu đúng byte), tính SHA-256 trên byte gốc — Phụ trách: B · Đầu ra: Hash khớp byte gốc
- [X] `P04-04` Mã hóa AES-256-GCM tài liệu riêng; bọc khóa bằng MASTER_KEY; backup MASTER_KEY — Phụ trách: B · Đầu ra: Chỉ ciphertext lên IPFS
- [X] `P04-05` Đăng nhập bằng chữ ký ví: challenge/verify, consume nonce nguyên tử — Phụ trách: ntn · Đầu ra: Nonce dùng lại bị từ chối
- [X] `P04-06` Cấp access token 20 phút, logout; DB chỉ lưu hash token — Phụ trách: ntn · Đầu ra: Bearer token, không cookie
- [X] `P04-07` Làm documents, grants và POST /documents/{id}/bind — Phụ trách: ntn · Đầu ra: Bind đúng receipt; bind chéo bị chặn
- [X] `P04-08` Kiểm RBAC khi đọc tài liệu: vai trò on-chain + ACL; Admin không mặc nhiên đọc — Phụ trách: B · Đầu ra: Ví không quyền nhận 403
- [X] `P04-09` Viết pytest I03–I06: nonce, ACL, ciphertext sai, bind; chạy trên database food_test (TEST_DATABASE_URL), từ chối chạy nếu tên database không kết thúc bằng _test — Phụ trách: ntn · Đầu ra: Test từ chối đúng; không bao giờ chạm food_dev hay DB deploy
- [X] `P04-10` Kiểm upload/retrieve 3 loại file đúng hash (I01); thử mất gateway — Phụ trách: ntn · Đầu ra: Báo lỗi, không báo xác minh giả

### FE

- [x] `P04-11` Viết lib/hash.ts: SHA-256 bằng crypto.subtle trên byte gốc — Phụ trách: C · Đầu ra: Dùng chung cho verify và upload
- [x] `P04-12` Đăng nhập ví: ký thông điệp, giữ token trong bộ nhớ (không localStorage) — Phụ trách: C · Đầu ra: Token hết hạn thì đăng nhập lại
- [x] `P04-13` Màn upload hồ sơ: hiện hash, CID của 3 loại file — Phụ trách: C · Đầu ra: Đề: upload khi nông dân đăng ký lô
- [x] `P04-14` Chặn createBatch khi bộ hồ sơ chưa upload đủ — Phụ trách: C · Đầu ra: Báo lỗi rõ, cho retry
- [ ] `P04-15` Màn tài liệu riêng: tải file, cấp/thu hồi quyền đọc (kèm endpoint GET /documents liệt kê tài liệu riêng của lô) — Phụ trách: C · Đầu ra: Logistics và Retailer của lô demo tải được; Farmer B, Admin, Consumer bị từ chối (Bảng 4)

## GĐ05. DApp

### Contract

- [ ] `P05-01` Sửa lỗi phát sinh khi tích hợp; cập nhật ABI — Phụ trách: A · Đầu ra: ABI thống nhất ba phía

### BE

- [X] `P05-02` Cấu hình CORS (ALLOWED_ORIGIN), chuẩn hóa mã lỗi, từ chối khi RPC lỗi — Phụ trách: ntn · Đầu ra: Không đoán quyền khi RPC lỗi

### FE

- [x] `P05-04` Farmer App: form nhập thông tin mùa vụ, hiển thị cố định "1 tấn (1.000 kg)", gửi createBatch với quantityKg = 1000 — Phụ trách: C · Đầu ra: Không cho nhập khối lượng khác; hiện tokenId, tokenURI và QR sau receipt
- [ ] `P05-05` Màn bàn giao: request, cancel, reject đúng ví và tuyến — Phụ trách: C · Đầu ra: Người nhận thấy pending request
- [ ] `P05-06` Màn nhận hàng: verify metadata → PDF → ảnh → so hash, rồi accept — Phụ trách: C · Đầu ra: Hash sai khóa nút nhận
- [ ] `P05-07` Màn Logistics: lô đang giữ và lịch sử readings — Phụ trách: C · Đầu ra: Chỉ thao tác đúng lô
- [ ] `P05-08` Màn Retailer: markSold — Phụ trách: C · Đầu ra: Chỉ từ Delivered
- [ ] `P05-09` Hiển thị rõ txHash và link Sepolia Etherscan sau mỗi giao dịch — Phụ trách: C · Đầu ra: Đối chiếu được trên Etherscan
- [x] `P05-10` Tạo QR (/trace/{chainId}/{contract}/{tokenId}) và cho tải về — Phụ trách: D · Đầu ra: Quét bằng camera mở đúng trang
- [x] `P05-11` Trang trace công khai: nhập batchCode/tokenId; trạng thái đang tải, không tìm thấy, lỗi RPC — Phụ trách: D · Đầu ra: Không cần ví
- [x] `P05-12` Trang trace: timeline nghiệp vụ và ownership history từ Transfer (không DB) — Phụ trách: D · Đầu ra: Không hiển thị một lần bàn giao thành hai lần đổi chủ
- [ ] `P05-13` Trang trace: txHash và link Etherscan ở mỗi mốc; link contract và ví — Phụ trách: D · Đầu ra: Đối chiếu Etherscan
- [x] `P05-14` Trang trace: xem chứng chỉ PDF/ảnh gốc (trình xem hoặc tab mới) và ảnh lô; hiện CID, ipfs://CID kèm URL gateway HTTPS; báo lỗi tải hoặc hash không khớp — Phụ trách: D · Đầu ra: Consumer xem được hồ sơ gốc không cần ví; PDF không bị thay bằng thumbnail
- [x] `P05-15` Trang trace: nhãn hết hạn cạnh trạng thái gốc; cảnh báo thu hồi kể cả Sold — Phụ trách: D · Đầu ra: Đọc dữ liệu mới mỗi lần mở
- [ ] `P05-16` Màn Admin: cấp/thu hồi vai trò, gán farmId — Phụ trách: D · Đầu ra: Có event
- [ ] `P05-17` Màn Admin: danh sách sự cố — Phụ trách: D · Đầu ra: Xem được báo cáo và lô liên quan
- [ ] `P05-18` Thêm npm scripts dev/build và README; build thành công — Phụ trách: C · Đầu ra: Build xanh trước mốc tiếp
- [ ] `P05-19` Chạy checklist trình duyệt: đổi ví, sai mạng, từ chối ký, timeout (I09), sửa 1 byte (I02) — Phụ trách: C · Đầu ra: UI không báo thành công giả

## GĐ06. IoT và truy ngược

### BE

- [x] `P06-02` Hỗ trợ tài liệu báo cáo sự cố: kiểm vai trò Retailer, lưu lên IPFS — Phụ trách: B · Đầu ra: Gắn đúng lô
- [ ] `P06-16` Hỗ trợ tài liệu lý do thu hồi: doc_type `recall_reason` (vai trò Admin, PDF hoặc JSON, bind chỉ cần token_id), migration 0003; `incident_report` nhận PDF hoặc JSON — Phụ trách: B · Đầu ra: Admin upload được lý do thu hồi, ví khác nhận 403

### FE

- [ ] `P06-03` Màn báo sự cố của Retailer: nhập mô tả, upload báo cáo, gọi reportIncident — Phụ trách: C · Đầu ra: Có tx báo sự cố
- [x] `P06-04` Cảnh báo vượt ngưỡng 8–15°C trên DApp — Phụ trách: D · Đầu ra: Mẫu 18°C hiện cảnh báo; không kết luận nhiễm khuẩn
- [ ] `P06-05` Trang truy ngược: tokenId → Transfer/readings → Farmer → farmId, harvestGroupId — Phụ trách: D · Đầu ra: Hiển thị lý do lô được đưa vào diện xem xét
- [ ] `P06-06` Tìm lô liên quan theo farmId + harvestGroupId; phân biệt khác nhóm, khác farm — Phụ trách: D · Đầu ra: Đúng 2 lô (COCONUT-001, 002)
- [ ] `P06-07` Admin thu hồi từng lô (recallBatch) kèm incidentId và lý do — Phụ trách: D · Đầu ra: Không tự thu hồi cả farm
- [ ] `P06-08` Kiểm QR lô thu hồi hiện cảnh báo kể cả Sold; giao dịch mới bị chặn — Phụ trách: D · Đầu ra: Đúng cả với lô đã Sold
- [ ] `P06-09` Đo thời gian truy ngược (đề: vài giây) và ghi số events, RPC, số lần đo — Phụ trách: D · Đầu ra: Bảng số liệu thật

### IoT

- [ ] `P06-10` Viết simulate.py: đọc .env, ABI, manifest; kiểm RPC, chainId, bytecode, ví Logistics — Phụ trách: D · Đầu ra: Đúng ví dự kiến
- [ ] `P06-11` Nạp readings.csv; kiểm ví đang giữ lô InTransit — Phụ trách: D · Đầu ra: Dùng số nguyên: 1250 = 12,50°C
- [ ] `P06-12` Build, ký, gửi recordTransit tuần tự; ghi txHash/status/gasUsed ra CSV — Phụ trách: D · Đầu ra: Không xung đột nonce
- [ ] `P06-13` Xử lý timeout (hỏi lại txHash); thêm --dry-run, --count, --interval — Phụ trách: D · Đầu ra: Không gửi trùng readingId
- [ ] `P06-14` Chạy local 5 readings; DApp thấy 5 events, 1 cảnh báo (I07) — Phụ trách: D · Đầu ra: Đúng đơn vị
- [ ] `P06-15` Kiểm truy ngược COCONUT-001 → COCONUT-002; 003, 004 không bị thu hồi (I08) — Phụ trách: D · Đầu ra: Đúng 2 lô

## GĐ07. Tích hợp, testnet và triển khai

### Chung

- [ ] `P07-01` Tạo endpoint RPC Sepolia (Alchemy); cấp test ETH cho 5 ví; kiểm chainId 11155111 — Phụ trách: D · Đầu ra: Số dư đủ cho demo
- [ ] `P07-02` Chạy lại toàn bộ contract tests, API tests, build frontend trước khi deploy (gồm C15–C17, trước đây P06-01) — Phụ trách: Cả nhóm · Đầu ra: Tất cả xanh
- [ ] `P07-03` Xác nhận frontend, backend, iot cùng trỏ một contract address và ABI — Phụ trách: Cả nhóm · Đầu ra: Ba phía cùng một deployment
- [ ] `P07-04` Chạy seed_demo.py: cấp vai trò trước, rồi tạo 4 lô COCONUT-001..004 — Phụ trách: D · Đầu ra: Admin cấp vai trò và farmId trước
- [ ] `P07-05` Chạy end-to-end trên bản deploy (I11): đăng nhập → upload → tải tài liệu riêng, cùng ví đọc từ hai thiết bị; mở trang trace từ điện thoại — Phụ trách: D · Đầu ra: HTTPS, CORS đúng origin
- [ ] `P07-06` Chạy I10: tải lại trang trace trên trình duyệt sạch, lịch sử dựng từ chain đúng; QR hiện recall sau Sold; link Etherscan mở đúng tx — Phụ trách: D · Đầu ra: Kết quả I10 có ngày, commit, chain/address

### Contract

- [ ] `P07-09` Cấu hình network Sepolia trong Hardhat 3; deploy bằng Ignition — Phụ trách: A · Đầu ra: Deploy receipt
- [ ] `P07-10` Lưu docs/deployments/sepolia.json (chainId, address, deployBlock, txHash, ABI hash, commit) — Phụ trách: A · Đầu ra: Manifest đầy đủ
- [ ] `P07-11` Cấp roles và farmId trên Sepolia cho 5 ví demo — Phụ trách: A · Đầu ra: Có event cấp vai trò
- [ ] `P07-12` Chạy tập ca contract trên Sepolia (C01, C02, C06, C07, C11, C13, C14, C17, C18) (ghi kết quả vào báo cáo, không tạo file) — Phụ trách: A · Đầu ra: Điền txHash và kết quả thật

### BE

- [ ] `P07-13` Chọn nhà cung cấp hosting; kiểm điều khoản gói miễn phí tại thời điểm chọn — Phụ trách: B · Đầu ra: Quyết định ghi vào docs
- [ ] `P07-14` Đóng gói Dockerfile; deploy backend lên PaaS có HTTPS — Phụ trách: B · Đầu ra: /health truy cập được
- [ ] `P07-15` Tạo PostgreSQL của nền tảng (database deploy riêng, không dùng chung với container cục bộ); đặt secret; chạy alembic upgrade head — Phụ trách: B · Đầu ra: Không có secret trong Git; mật khẩu và MASTER_KEY khác bản cục bộ
- [ ] `P07-16` Đặt ALLOWED_ORIGIN, AUTH_DOMAIN đúng domain frontend; MASTER_KEY riêng cho bản deploy — Phụ trách: B · Đầu ra: Đăng nhập ví chạy trên bản deploy

### FE

- [ ] `P07-17` Build; đặt VITE_*, VITE_PUBLIC_RPC_URL (giới hạn quota/origin); deploy hosting tĩnh có HTTPS — Phụ trách: C · Đầu ra: Mở được từ điện thoại
- [ ] `P07-18` Tạo lại QR trỏ tới URL đã deploy; quét thử bằng điện thoại — Phụ trách: D · Đầu ra: Mở đúng trang trace

### IoT

- [ ] `P07-19` Gửi 5 readings lên Sepolia bằng ví Logistics — Phụ trách: D · Đầu ra: Log txHash, đúng đơn vị

## Tùy chọn và phần cắt trước

### Nên có (làm sau khi luồng chính ổn)

- [x] `OP-01` Biểu đồ nhiệt độ đẹp (Recharts) theo thời gian, đánh dấu vùng ngưỡng 8–15°C — Phụ trách: D · Đầu ra: Biểu đồ trên DApp và trang trace
- [ ] `OP-02` Bộ lọc lịch sử trên trang trace và trang Logistics — Phụ trách: D · Đầu ra: Lọc theo loại mốc, thời gian
- [ ] `OP-03` Xuất báo cáo tổng hợp (lô, timeline, readings) — Phụ trách: D · Đầu ra: File xuất mở được

### Cắt trước nếu thiếu thời gian

- [ ] `OP-04` Hết hạn yêu cầu bàn giao — Phụ trách: A · Đầu ra: Request quá hạn bị đóng
- [ ] `OP-05` Quy trình thay ví đang giữ lô — Phụ trách: A · Đầu ra: Có test và ghi rõ giới hạn
- [ ] `OP-06` Khôi phục vai trò — Phụ trách: A · Đầu ra: Có test
- [ ] `OP-07` Bọc khóa RSA/ECIES theo từng người nhận — Phụ trách: B · Đầu ra: Chỉ làm sau cùng, không nằm trên đường găng
