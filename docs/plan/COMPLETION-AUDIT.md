# Rà soát hoàn thiện COCOMARK — Bước 01

Ngày: 24/11/2026. Nhánh kiểm tra: `nguyen`.

## Phạm vi và cách đọc kết quả

Báo cáo đối chiếu source local với Đề bài.docx, Rubik.xlsx và các mã việc trong CODE.md. Đây là báo cáo bổ sung theo yêu cầu của Nini, không thay thế danh sách việc CODE.md, không tự đánh dấu các ô nghiệm thu.

- **Có code:** đã đọc thấy đường thực hiện; chưa đồng nghĩa đã chạy thành công.
- **Thiếu:** chưa tìm thấy đầu ra trong phạm vi repository đã kiểm tra.
- **Cần xác minh:** cần giao dịch, môi trường hoặc kết quả chạy để kết luận.
- Chưa chạy bộ test, build, browser hay giao dịch trong bước 01. Không đọc/in giá trị secret và không thay đổi dữ liệu ứng dụng.

Thay đổi có sẵn trước rà soát, cần giữ nguyên:

- `docs/diagrams/02-nghiep-vu.drawio`
- `docs/diagrams/05-wireframes.drawio`
- `frontend/src/features/logistics/OutgoingPage.tsx`

## Đối chiếu yêu cầu và bằng chứng source

| Yêu cầu | Bằng chứng trong repository | Kết luận và đầu ra còn cần |
|---|---|---|
| Tạo lô bởi Trusted Farmer | `contracts/contracts/FoodTraceability.sol`: createBatch, _validateBatch, assignFarmer | Có role Farmer, farmId, mã duy nhất, ngày hợp lệ, khối lượng 1000. Cần chạy lại test quyền và input. |
| NFT và lịch sử sở hữu | Cùng contract: ERC721URIStorage, _safeMint, _safeTransfer, tokenURI; test trong `contracts/test/` | Có code mint/chuyển NFT và chặn đường chuyển trực tiếp. Cần receipt và lịch sử trên deployment cuối. |
| Bàn giao có xác minh | requestTransfer/acceptTransfer/rejectTransfer/cancelTransfer; `frontend/src/features/retailer/IncomingPage.tsx`; `frontend/src/features/logistics/services/logisticsChain.ts` | Có code đối chiếu bytes ba hồ sơ; Pending chưa đổi owner, accept mới đổi owner/lifecycle. Cần chạy xuyên suốt hai lần bàn giao. |
| Ghi nhiệt độ/vị trí | recordTransit và TransitRecorded; `backend/scripts/seed_local.py` dùng Web3.py ghi readings | Seed đã có code Web3.py; chưa có công cụ cảm biến độc lập trong `iot/` (chỉ .gitkeep). |
| Sold/Expired/Recalled | _checkNotLocked và isExpired; `contracts/test/FoodTraceability.lifecycle.ts` | Có kiểm tra theo block.timestamp. Cần phân tích lệch với giờ máy frontend và tái hiện phản ánh bán sau hạn. |
| DApp tương tác on-chain | `frontend/src/services/tx.ts`, farmerChain.ts, logisticsChain.ts, retailerChain.ts, adminChain.ts | Có đọc/ghi và đợi receipt; chưa kết luận mọi màn hình đã tích hợp đầy đủ hoặc chạy đúng. |
| Ba loại dữ liệu IPFS | `backend/app/services/ipfs.py`, upload_rules.py, metadata.py; FarmerCreatePage.tsx | Có upload/retrieve PDF, JPEG/PNG, JSON; SHA-256 trên bytes; có upload/bind hồ sơ sau mint. Cần kiểm chứng luồng thật và phục hồi lỗi. |
| Ảnh WebP đã được phê duyệt | FarmerCreatePage.tsx chỉ nhận JPEG/PNG; upload_rules.py và EXTENSION trong document_service.py chưa có WebP | Thiếu hỗ trợ đồng bộ. Đây là yêu cầu sản phẩm đã duyệt, không phải định dạng bắt buộc riêng của rubric. |
| Mã hóa thông tin nhạy cảm | `backend/app/core/crypto.py`, document_service.py | Có AES-256-GCM, khóa tài liệu ngẫu nhiên, bọc khóa; IPFS nhận ciphertext. Cần chạy kiểm tra giải mã/tamper và luồng UI. |
| Kiểm soát truy cập tài liệu | document_service.py: grant_access/revoke_grant/read_private_document/list_private_documents; api/documents.py | Có kiểm uploader/grant và role on-chain ở backend. RetailerPrivateDocuments.tsx gọi API và đối chiếu hash bản rõ. Cần kiểm tra sau thu hồi quyền; không xây lại ACL. |
| Truy ngược sự cố trong vài giây | `frontend/src/features/admin/services/adminChain.ts`: readAdminIncidentDetail, related theo farmId + harvestGroupId, durationMs | Có code truy ngược và đo thời gian. Cần đo thật; không tự kết luận mọi lô cùng farm đều nhiễm hoặc thu hồi cả farm. |
| Testnet | `contracts/hardhat.config.ts` có Sepolia; `contracts/ignition/modules/FoodTraceability.ts` | Có cấu hình/module. Chưa thấy `docs/deployments/` hoặc `contracts/ignition/deployments/`; chưa có bằng chứng đủ để xác nhận đã deploy Sepolia. |
| Báo cáo và modeling | `docs/diagrams/` có architecture/nghiệp vụ/sequence/data model/wireframes | Có tài liệu nền. Chưa nghiệm thu nội dung, báo cáo/slide và minh chứng theo rubric. |

Ánh xạ ba nghiệp vụ của đề:

| Đề bài | Hiện thực |
|---|---|
| harvestProduct | createBatch |
| updateTransitStatus | recordTransit |
| receiveAndVerify | kiểm SHA-256 ở client + acceptTransfer(hashes) |

Contract chỉ so sánh hash người nhận cung cấp với hash lưu trên chain; thao tác tải/băm tệp diễn ra ngoài chain. Không mô tả contract tự tải và băm IPFS.

## Danh sách vấn đề cần xử lý

| Mã rà soát | Ưu tiên | Bằng chứng / vấn đề | Hướng xử lý và điều kiện hoàn thành |
|---|---|---|---|
| A01 | Cao | Chưa có simulator độc lập; CODE.md P02-21/22, P06-10 đến P06-14 đã dự kiến | Làm readings.csv + simulate.py theo mã việc sẵn có, kiểm mạng/contract/Logistics/owner/InTransit, gửi tuần tự và ghi receipt; timeout không gửi lặp mù. Có dry-run/count/interval theo kế hoạch gốc. |
| A02 | Cao | Chưa có bằng chứng Sepolia; P07-01 đến P07-12 | Chuẩn bị deploy/manifest/roles/ABI/config đồng nhất; triển khai với ví testnet do nhóm kiểm soát và lưu thông tin công khai. Không dùng khóa Hardhat công khai cho ví có tài sản. |
| A03 | Cao | Retailer và Logistics dùng Date.now() để tính expired, contract dùng block.timestamp | Hiển thị rõ cơ sở thời gian; xác minh block lúc markSold và expiry để kết luận đúng. Không tự đổi hạn sử dụng hoặc bỏ chặn contract. |
| A04 | Cao | recordTransit/markSold/reportIncident kiểm owner và lifecycle, nhưng không kiểm role hiện hành trực tiếp | Đối chiếu contract-spec về Logistics/Retailer đang giữ; quyết định chính sách sau revoke role trước khi sửa. Bổ sung kiểm role/test nếu chính sách yêu cầu; đánh giá ABI/deployment tác động trước deploy. |
| A05 | Vừa | WebP chưa có ở cả frontend/backend | Hỗ trợ MIME và signature WebP, extension lưu đúng, giữ bytes gốc và hash; kiểm metadata/render/nhận bàn giao không phụ thuộc tên batch.jpg. |
| A06 | Vừa | Incoming Retailer tìm tài liệu bằng tên cố định metadata.json/certificate.pdf/batch.jpg | Rà cách reader đặt tên trước khi đổi; nếu tên ảnh thay đổi, nhận diện theo loại tài liệu để không chặn nhận PNG/WebP. |
| A07 | Vừa | Lỗi nonce trước đây bị báo chung là lỗi MetaMask; tx.ts đã có xử lý một số mã nonce | Tái hiện/kiểm cách parse lỗi RPC lồng; hiển thị nguyên nhân phù hợp, không tự reset ví hay tự gửi lại giao dịch đã broadcast. |
| A08 | Vừa | QR từng bị lặp ở Retailer; source hiện truyền showQr=false cho TraceTechnicalPanel | Xác minh browser trước khi sửa; không ghi đây là lỗi còn tồn tại nếu chưa tái hiện. |
| A09 | Cao | Source AES/ACL/upload/bind và truy ngược đã có, checklist còn nhiều ô chưa tick | Kiểm luồng thật sau khi code hoàn thiện; chỉ bổ sung thiếu sót cụ thể. Người dùng nghiệm thu/tick CODE.md, không coi ô trống là bằng chứng chưa code. |

Không có yêu cầu trong đề/rubric đã đọc buộc triển khai thay ví, khôi phục tài khoản hoặc kiểm toán độc lập. Không thêm các dự án này vào phạm vi hoàn thiện mặc định. Không cần thiết bị IoT vật lý vì đề cho phép cảm biến giả lập/form.

## Thứ tự thực hiện sau bước 01

1. **Bước 02 — contract:** chốt A04 theo đặc tả, sửa ràng buộc thiếu nếu xác nhận; giữ đúng vòng đời, flags, Pending và ownership. Kiểm tra phù hợp trước khi phát hành ABI/deploy mới.
2. **Bước 03 — kết nối:** rà bốn role trên nguồn chain thật; giải quyết A03/A06/A07 và lỗi tích hợp xác định được, không thiết kế lại UI đã duyệt. Bảo toàn OutgoingPage.tsx đang có thay đổi local.
3. **Bước 04 — IoT:** thực hiện A01 theo P06-10..14.
4. **Bước 05 — IPFS:** A05, upload/retrieve/metadata/hash, phục hồi upload/bind theo receipt; không tự tạo CID hoặc trạng thái verified.
5. **Bước 06 — tài liệu riêng:** hoàn thiện phần nối UI/backend còn thiếu trên cơ chế AES/ACL đã có; không viết hệ thống thứ hai.
6. **Bước 07 — truy ngược:** hoàn thiện thiếu sót nếu có theo P06-05..09/15; đo thời gian thật và bảo đảm phân biệt nhóm liên quan/đối chứng.
7. **Bước 08 — triển khai:** A02; cấu hình frontend/backend/IoT cùng deployment, chuẩn bị HTTPS/origin/QR nếu demo nhiều thiết bị theo P07-13..18.
8. **Bước 09 — nghiệm thu:** chạy toàn bộ contract/API/build và các luồng nghiệp vụ; sửa lỗi theo kết quả. Chuẩn bị báo cáo/slide/video theo rubric.

Mỗi bước code có kiểm tra kỹ thuật phù hợp để không tích lũy lỗi; đợt chạy toàn bộ luồng nghiệp vụ diễn ra sau khi hoàn thiện code theo yêu cầu Nini.

## Điều kiện kết thúc đồ án

- Có tối thiểu ba nghiệp vụ contract và hai ràng buộc được giải thích, có minh chứng testnet.
- DApp thực hiện tạo lô, bàn giao/nhận và thao tác trạng thái qua giao dịch; hiển thị txHash/receipt đúng mạng.
- IoT Web3.py ghi nhiệt độ/vị trí, DApp dựng được lịch sử từ chain.
- PDF/ảnh/JSON upload và retrieve được; kiểm chứng bytes thật; hóa đơn nhạy cảm mã hóa và có kiểm soát quyền backend.
- Mint một NFT/lô và chuyển quyền theo hai chặng; lịch sử ERC-721 không bị đếm hai lần thành bàn giao nghiệp vụ.
- Demo báo sự cố, truy đúng farm/nhóm/lô liên quan và cảnh báo thu hồi kể cả Sold.
- Chạy tổng duyệt để tránh lỗi giao dịch ngoài chủ đích; rubric đặt mức tối đa một lỗi giao dịch trong demo.
- Báo cáo/slide có caption hình/bảng, chữ viết tắt, tài liệu tham khảo, kích thước chữ theo rubric (slide >18, Word >14), tương phản và video có caption nếu sử dụng.

## Cập nhật bước 02 — 24/11/2026

- A04: đã bổ sung `_checkRole(LOGISTICS_ROLE, msg.sender)` cho recordTransit và `_checkRole(RETAILER_ROLE, msg.sender)` cho markSold/reportIncident. Kiểm tra sau owner/lifecycle để giữ thứ tự báo lỗi hiện có.
- Bổ sung bốn ca hồi quy trong FoodTraceability.lifecycle.ts: revoke/cấp lại Logistics ghi cùng readingId; revoke/cấp lại Retailer bán lô; revoke/cấp lại Retailer báo sự cố ở Delivered và Sold. Các ca kiểm owner/lifecycle/incidentId không đổi sau revert.
- Giữ điều kiện reportIncident vẫn được phép khi expired/recalled nếu chủ NFT còn vai trò Retailer; không đổi quyền cancel/reject pending.
- Cập nhật contract-spec.md cho yêu cầu còn role hiện hành. Không đổi chữ ký hàm/event hoặc thêm custom error. Cần đối chiếu ABI sau compile.
- Thay đổi bytecode chỉ có hiệu lực sau deploy mới. Chưa reset/seed/deploy local hoặc Sepolia; dữ liệu đang chạy không tự thay đổi.
- Kiểm tra: `git diff --check` đạt. Đã thử `hardhat compile` và `hardhat test` bằng Node 22.23.3; tiến trình nạp dependencies kéo dài, chưa có kết quả compiler/test trước khi dừng. Log chẩn đoán ngoài repository: `/private/tmp/cocomark-hardhat-debug.log`. Chưa báo bước 02 nghiệm thu hoặc test Pass; còn phải chạy compile/test và đối chiếu ABI artifact.

### Lần xác minh tiếp theo

- Xác định lỗi sandbox chặn ghi cache compiler tại Library/Caches/hardhat-nodejs; chạy lại với quyền phù hợp, không sửa cấu hình dự án.
- Compile Solidity 0.8.28 thành công. Runtime bytecode 15.893 byte. ABI artifact khớp contracts/abi, frontend/src/contracts và backend/app/services/abi; không cần thay ba bản ABI.
- Compiler cảnh báo unreachable code trong ERC721.sol: liên quan đường chuyển trực tiếp bị ứng dụng chặn. Không sửa dependency OpenZeppelin.
- Kết quả cuối: chạy `hardhat test mocha --no-compile` sau compile, **95 passing (32s)**, gồm bốn test revoke/cấp lại role. Lần đạt dùng Node 22.23.3 với source maps và TSX cache tắt tạm qua preload ngoài repository; không dùng các bản bundle dependency thử chẩn đoán. Log: `/private/tmp/cocomark-step2-mocha.log`. Không sửa node_modules hoặc cấu hình Hardhat. Bước 02 đã qua kiểm tra code/contract; chưa deploy mới.

## Cập nhật bước 03 — kết nối các role

- Farmer, Logistics và Retailer đọc thêm isExpired() từ contract, kết hợp với kiểm tra giờ máy theo chính sách thận trọng đã có ở Admin: chain hoặc đồng hồ máy báo qua hạn thì UI không cho thao tác bị khóa. Không dùng giờ máy để ghi đè trạng thái contract.
- Giữ phân biệt session expiry (giờ máy) với batch expiry (đọc chain và thời hạn). Khi gửi giao dịch, contract tiếp tục là nơi quyết định cuối cùng theo block.timestamp.
- tx.ts đọc lỗi qua các lớp info.error/error/cause/data.originalError với giới hạn và chống vòng; phân biệt nonce too high/low, từ chối ký lồng trong RPC, lỗi revert, timeout, thiếu ETH. Không tự reset MetaMask hoặc tự retry transaction.
- Bảy kiểm tra thông báo lỗi trên bundle source thực đã đạt, gồm lỗi nonce RPC lồng, từ chối ký lồng, NONCE_EXPIRED, CALL_EXCEPTION, TIMEOUT, INSUFFICIENT_FUNDS, cause tham chiếu vòng. Script kiểm tra tạm nằm ngoài repository.
- Rà luồng hiện có: Farmer upload/bind sau receipt; Logistics xác minh hồ sơ/nhận/ghi nhiệt độ/gửi Retailer; Retailer kiểm ba file/nhận/bán/báo sự cố; Admin truy ngược/thu hồi. Chưa chạy tổng duyệt giao diện hay khẳng định tất cả luồng này Pass.
- Chưa truy được receipt thời điểm bán COCONUT-002 trong phản ánh cũ; chưa kết luận nguyên nhân lệch giờ và không chỉnh hạn sử dụng để che lỗi.
- Không sửa OutgoingPage.tsx đang có thay đổi của người dùng; không đổi Header/Sidebar/session/role guard hoặc seed/reset dữ liệu.
- Kết quả kiểm tra bước 03: `npm run lint`, `npm run typecheck`, `npm run build` đều exit 0; bảy kiểm tra lỗi giao dịch đạt; `git diff --check` đạt. Build có cảnh báo chunk >500 kB, không chặn build. Log nằm ngoài repository tại `/private/tmp/cocomark-step3-{lint,typecheck,build}.log`.
- Đã hoàn thiện phần code trong phạm vi rà soát bước 03; nghiệm thu giao diện và luồng liên role trên deployment thật để ở đợt tổng duyệt. A05/WebP thuộc bước 05; IoT thuộc bước 04; chưa mở rộng sang các phần đó.

## Cập nhật bước 04 — 25/11/2026

- Thực hiện simulator theo P06-10..14 trong `iot/simulate.py`; CSV năm mẫu 10/12/18/13/11°C. Không dùng backend để ghi nhiệt độ và không tạo ABI giả.
- Cấu hình dùng RPC_URL, CHAIN_ID, CONTRACT_ADDRESS, DEPLOY_BLOCK; bổ sung IOT_LOGISTICS_ADDRESS/IOT_PRIVATE_KEY riêng cho công cụ. Có manifest và kiểm xung đột; đầy đủ biến môi trường thì bỏ qua đọc dotenv để tránh file iCloud dataless.
- Kiểm mạng, bytecode, Logistics role, owner, lifecycle InTransit, hết hạn/thu hồi; eth_call trước gửi; ký và chờ receipt tuần tự. Không đổi owner/lifecycle.
- Có dry-run/count/interval/timeout/token-id/output/receipt; journal CSV lưu txHash trước broadcast và kết quả receipt, gắn chain/contract/genesis/ví. Sau timeout dừng; lần sau kiểm receipt và events, không tự gửi trùng readingId.
- Kiểm tra hoàn tất: 9/9 unit tests; Python py_compile đạt. Tích hợp trên Hardhat riêng cổng 18545 với artifact contract thật đã compile: dry-run không phát tx; timeout rồi tìm receipt; đủ 5 TransitRecorded đúng đơn vị và một mẫu vượt 15°C; chạy lại không thêm giao dịch; chặn sai mạng/role, readingId khác nội dung, role bị revoke và chủ cũ sau bàn giao. Owner/lifecycle không đổi khi chỉ ghi readings.
- Môi trường kiểm tra tạm ngoài iCloud dùng Web3.py 7.13.0, python-dotenv 1.2.4 và Hardhat 3.20.0, vì một số dependency và .env trong Documents có cờ dataless. Không sửa venv/node_modules hoặc .env hiện có. Node riêng đã dừng sau kiểm tra; không tác động node 8545, seed, DB hay Pinata.
- Chưa quan sát trực tiếp tab Nhiệt độ/Hành trình của DApp cho dữ liệu simulator, chưa chạy Sepolia; I07 chưa được tự tick. Còn nghiệm thu DApp ở đợt demo cuối. Hướng dẫn chạy và điều kiện chọn lô có trong `iot/README.md`.

## Cập nhật bước 05 — 25/11/2026

- A05: frontend và backend nhận JPEG/PNG/WebP bằng signature byte gốc; frontend kiểm thêm MIME và phần mở rộng. Giữ nguyên File, không đổi PNG/WebP thành JPEG; backend lưu MIME/phần mở rộng đúng. Chặn 10 MB trước khi frontend đọc/băm toàn bộ tệp, backend vẫn kiểm độc lập.
- A06: reader gắn loại tài liệu certificate/image/metadata riêng với tên hiển thị. Nhận diện tên ảnh từ byte tải về; Retailer xác minh theo loại tài liệu, giữ thứ tự ba hash metadata/certificate/image khi acceptTransfer. Logistics dùng nhãn ảnh không cố định JPG. Không đổi fixture seed.
- Wizard lưu từng kết quả upload đã đối chiếu hash để có thể thử lại phần còn thiếu; kiểm phiên chọn tệp để không dùng kết quả upload cũ sau khi đổi tệp. Chưa kiểm trường hợp máy chủ đã lưu nhưng phản hồi bị mất: không tuyên bố upload idempotent ở cấp backend/Pinata.
- Pinata adapter từ chối phản hồi CID sai kiểu/định dạng và JSON response sai cấu trúc; không in JWT. Metadata từ chối nhiệt độ NaN/Infinity. Public reader chỉ dùng JSON object sau khi hash byte gốc khớp chain, giới hạn byte khi đọc stream gateway.
- Kiểm tra độc lập: 8 unit tests backend đạt, 4 tests frontend đạt; gồm signatures, hash/byte gốc, dữ liệu bị thay đổi, metadata whitespace, gateway fallback, CID response lỗi và giới hạn kích thước. HTTP Pinata được mock; không dùng JWT, không upload thật, không chạm DB/node local. Python py_compile và git diff --check đạt.
- Lệnh chạy lại: `PYTHONPATH=backend python -m unittest discover -s backend/tests -p test_file_integrity_unit.py -v`; trong frontend: `node --test tests/file-integrity.test.mjs`.
- Frontend: lint, typecheck, build đều exit 0 trên bản sao nguyên source/config/public và đúng package-lock tại `/private/tmp/cocomark-frontend-verification`, Node 22.23.3; không sao chép .env. Các lần chạy trong thư mục gốc bị chờ dependency iCloud dataless nên đã dừng đúng các tiến trình kiểm tra do tác giả chạy, không dừng dịch vụ của người dùng. Build vẫn cảnh báo chunk >500 kB. Log: `/private/tmp/cocomark-step5-{lint,typecheck,build}-tmp.log`.
- Còn nghiệm thu trong đợt demo: upload/retrieve thật PDF + PNG/WebP + metadata, thử gateway lỗi trên DApp, retry sau upload lỗi và nhận bàn giao sau kiểm ba hash. ACL/mã hóa riêng thuộc bước 06; Sepolia thuộc bước 08. Chưa tự tick thêm CODE.md.

## Cập nhật bước 06 — 25/11/2026

- Rà cơ chế có sẵn: hóa đơn private được mã hóa AES-256-GCM trước IPFS; DB chỉ giữ khóa dữ liệu đã bọc bởi MASTER_KEY. Bind hóa đơn kiểm Farmer tạo lô, không thay bằng owner hiện tại. Read/list kiểm uploader hoặc grant chưa thu hồi và vai trò nghiệp vụ hiện hành; Admin/Farmer khác/Consumer không có quyền mặc định. Không tạo hệ thống ACL mới.
- Sửa Farmer tải file trước khi xử lý hash sai: Farmer và Retailer dùng chung downloadVerifiedPrivateDocument, đối chiếu SHA-256 byte giải mã với cả hash danh sách và X-Document-Sha256 trước khi cho lưu. Hash sai/thiếu thì từ chối. Thông báo phân biệt lỗi IPFS, ciphertext và hash backend, không gọi hash hóa đơn là hash on-chain.
- Request list/content dùng no-store; backend thêm Cache-Control: no-store cho danh sách (content đã có). Farmer/Retailer remount vùng tài liệu theo ví/phiên/tokenId, hủy request tải khi rời vùng dữ liệu và bỏ phản hồi list đến muộn. Không sửa SessionProvider, role guard hoặc bố cục đã duyệt.
- AES-GCM kiểm phiên bản byte trong header khớp phiên bản đã gắn trong AAD; không đổi định dạng gói hoặc khóa cũ. Bổ sung ca sửa byte version và cache header trong bộ test hiện có.
- Thêm backend/tests/test_private_documents_unit.py: dịch vụ thật + AES thật, DB SQLite trong RAM, chain/IPFS giả. Không thay PostgreSQL, không chạy migration/reset DB của người dùng. Docker local hiện không chạy; bộ API/PostgreSQL đầy đủ để ở đợt nghiệm thu.
- Kết quả: 9/9 backend unit tests đạt, gồm ma trận đọc, thu hồi/cấp lại không nhân bản grant, mất role/RPC lỗi, chỉ uploader quản lý, grantee không thấy danh sách grant, bind theo creator, mã hóa mới dùng vật liệu khóa mới, ciphertext/header/key/hash sai và gateway lỗi. Venv tạm dùng Python 3.12, cryptography 46.0.3 và SQLAlchemy 2.0.44; không đổi requirements.lock (phiên bản khóa của dự án khác), chưa thay thế kiểm tra trên stack PostgreSQL/lockfile đầy đủ. Lệnh chạy: `PYTHONPATH=backend python -m unittest discover -s backend/tests -p test_private_documents_unit.py -v`.
- Frontend: 4 tests private-documents đạt; lint/typecheck/build exit 0 với đúng source và lockfile trên bản sao /private/tmp, Node 22.23.3. Build còn cảnh báo chunk >500 kB. Python py_compile và git diff --check đạt. Chưa nghiệm thu browser/MetaMask/Pinata thật hoặc tuyên bố đã hoàn tất P04-15; không tự tick CODE.md.

### Xác minh tiếp bước 06 với PostgreSQL và Pinata thật — 25/11/2026

- Sau khi Nini bật Colima, container food-traceability-db healthy. Kiểm riêng TEST_DATABASE_URL là food_test và khác DATABASE_URL trước khi chạy; không reset food_dev.
- Cài chính xác backend/requirements.lock vào /private/tmp/cocomark-backend-locked để tránh dependency iCloud dataless trong venv gốc. Các phiên bản gồm FastAPI 0.153.0, SQLAlchemy 2.1.5, cryptography 50.0.2, Web3 7.13.0, pytest 9.1.1, psycopg 3.3.6, Alembic 1.20.0; pip check đạt. Không đổi lockfile hoặc venv dự án.
- Chạy toàn bộ pytest trên source thực với PostgreSQL food_test: **81 passed, 25 subtests passed**, exit 0, 14.67s. Có hai cảnh báo deprecation từ Starlette/httpx và websockets. Gồm các ca API ACL, grant/revoke/regrant, bind, session/nonce, kiểm ciphertext/AAD/key/hash và các ca thêm bước 05–06. Log: /private/tmp/cocomark-step6-postgres.log.
- Chạy backend/tests/e2e_local.py với real_ipfs=True qua wrapper tạm ngoài repo, chỉ đổi RPC của lần chạy sang node riêng 18545: **65 đạt, 0 lỗi**, exit 0. Contract thật + API TestClient + PostgreSQL thật + Pinata thật; ví kiểm thử tạo ngẫu nhiên, upload tệp kiểm thử tổng hợp. Xác nhận hóa đơn mã hóa/đọc lại đúng byte cho uploader và grantee, chặn Farmer B/Admin/ví lạ, mất role thì mất quyền đọc; thêm các kiểm tra hai chặng NFT, nhiệt độ, bán và thu hồi có sẵn trong script. Log: /private/tmp/cocomark-step6-real-ipfs.log.
- food_test được bộ test dựng lại/dọn theo fixture; không chạm food_dev. Block và nonce Admin của node 8545 trước/sau giống nhau (block 0x3a, nonce 0x6); không thay sáu lô người dùng vừa seed. Node test 18545 đã dừng; node 8545 và Docker được giữ chạy.
- Giới hạn SQLite/phiên bản thư viện tạm ở lần trước đã được bổ sung bằng lần PostgreSQL + đúng lockfile này. Chưa nghiệm thu thao tác giao diện/MetaMask, không coi TestClient là browser; chưa chạy testnet Sepolia. Không tự tick CODE.md hoặc đánh dấu bước 07–09 hoàn thành.

## Cập nhật bước 07 — 25/11/2026

- Xác nhận nhánh nguyen; PostgreSQL container healthy và Hardhat 8545 chainId 31337 đang chạy. Giữ mọi thay đổi trước đó, không seed/reset sáu lô của người dùng.
- Admin reader đếm JSON-RPC request thực gửi (gồm chainId, chia khoảng và retry), tách thời gian truy ngược chain khỏi tải bằng chứng IPFS. Tải báo cáo/lý do thu hồi song song; giới hạn bytes trong lúc đọc response. JSON báo cáo/lý do thu hồi chỉ được dùng làm mô tả sau khi SHA-256 khớp; request hủy không bị nuốt thành lỗi gateway.
- Bổ sung số đo vào khối Số liệu truy ngược hiện có; không thay Header/Sidebar, logic session, phạm vi thu hồi hoặc UI các trang khác.
- Integration test mới triển khai contract thật trên Hardhat riêng 18545 và gọi reader source thực qua RPC proxy/gateway HTTP fixture. Sáu nhóm con đạt, tổng Node runner báo 7 tests pass, 0 fail: cohort/đối chứng, năm lần đo, RPC chia khoảng, hash sai/gateway lỗi, thu hồi riêng từng lô Sold và các lỗi mạng/not found/abort. Không gọi Pinata thật trong test bước 07.
- Năm lần đo chain 47/67/54/68/60 ms; tổng 169/189/176/190/182 ms, 62 JSON-RPC requests và 14 event giải mã mỗi lần. Gateway fixture thêm 120 ms trễ có kiểm soát. Không xem kết quả local bốn lô này là số đo Sepolia hoặc benchmark dữ liệu lớn. Chi tiết và lệnh chạy tại docs/notes/incident-trace-validation.md.
- npm run lint, npm run typecheck, npm run build đạt trên bản sao source/config/public đúng lockfile ngoài iCloud; git diff --check đạt. Build còn cảnh báo chunk >500 kB. Block 8545 trước/sau vẫn 0x3a; node test riêng được dừng, giữ Docker/8545.
- Hoàn thiện phần code/kiểm thử tự động trong phạm vi bước 07. Nghiệm thu browser/MetaMask để ở bước 09; Sepolia thuộc bước 08, chưa triển khai trong lượt này. Không tự tick CODE.md, không commit/push/merge.

## Chuẩn bị bước 08 — 25/11/2026

- Nini xác nhận chưa có ví/RPC/ETH Sepolia và cần hướng dẫn. Không phát transaction testnet, không tạo manifest/deployment/txHash giả. Không coi bước 08 đã hoàn tất.
- Tái sử dụng network Sepolia và module Ignition có sẵn. Thêm contracts/scripts/sepolia.mjs: preflight chỉ đọc mạng/số dư/ước tính gas/ABI, chặn ví Hardhat mặc định; finalize kiểm receipt, ví, bytecode và block canonical trước lưu docs/deployments/sepolia.json; roles mặc định chỉ đọc, --apply cấp role/farmId với journal hash và chờ receipt, không seed hoặc ghi đè farmId khác.
- Manifest lưu ABI/runtime hash, commit và dirty flag, địa chỉ ví công khai; không chứa RPC/API key/private key. FE/BE/IoT tiếp tục dùng biến cấu hình sẵn có, không thay runtime local.
- Tạo .env.sepolia.example và hướng dẫn docs/notes/sepolia-deployment.md. Tạo .env.sepolia trống quyền 600, Git bỏ qua; không ghi đè .env/.env.local hay secret của người dùng.
- Kiểm thử: 95 contract tests đạt trên đúng source hiện tại ở runtime ngoài iCloud; 2 tests công cụ đạt với provider giả lập (nhiều nhánh receipt/mạng/bytecode/địa chỉ lỗi), không gọi đây là kiểm chứng Sepolia. Preflight thiếu RPC dừng có thông báo như mong đợi. ABI FE/BE/export khớp artifact, git diff --check đạt. Không sửa frontend nên không chạy lại lint/build frontend trong bước này.
- Còn phải làm với cấu hình thật: nhận ETH test cho năm ví, preflight live, Ignition deploy, finalize manifest, cấp role/farmId, giao dịch kiểm thử và IoT trên Sepolia. Chưa có seed_demo.py testnet được kiểm chứng; không dùng seed_local.py vào Sepolia. Hosting HTTPS/DB deploy/origin/QR cần quyết định nhà cung cấp; nghiệm thu giao diện gom bước 09. Không tự tick CODE.md, không commit/push/merge.

### Triển khai bước 08 thực tế — 26/11/2026

- Giữ nhánh nguyen và mọi thay đổi trước đó. Preflight live đạt với năm ví mỗi ví 0.05 SepoliaETH trước deploy. Không chuyển ETH giữa các ví.
- Deploy qua Ignition bằng runtime đúng source/lockfile ngoài iCloud. Contract 0x650525fC71559CafcF37DcF8fA2844a5577f2FD3, block 12215175, tx 0x0f2921bcf1577fb95a1ce945284bb2480972861a518735d7f58711538cb5e999. Finalize kiểm creation/runtime bytecode khớp artifact, receipt status 1, block canonical, ví deploy có Admin.
- Lưu docs/deployments/sepolia.json và journal/artifacts/build-info Ignition vào contracts/ignition/deployments/chain-11155111. Manifest chứa ABI/runtime/source hash, commit và dirty=true; không có secret/RPC URL. Chưa verify source trên Etherscan, không đánh đồng receipt trên explorer với source verification.
- Bốn giao dịch cấp quyền đã confirmed, txHash trong manifest: Farmer A/FARM-A, Farmer B/FARM-B, Logistics, Retailer. Read-only chạy lại cho actions=[]; không seed lô hoặc đổi owner/lifecycle. Không sửa cấu hình local hoặc dữ liệu sáu lô trên Hardhat.
- Chuẩn bị hosting 0 đồng/không thẻ: backend Dockerfile + .dockerignore, scripts/start_hosted.py (kiểm Sepolia/HTTPS/DB remote TLS/origin/domain/key rồi Alembic trước Uvicorn), render.yaml plan free, frontend/vercel.json SPA rewrite, .env.hosting.example. Tạo .env.hosting ignored quyền 600, cấu hình chain thật và MASTER_KEY mới cho DB hosted; không chứa khóa ví, không đổi .env/.env.local.
- Kiểm thử: 12 hosted-startup tests đạt; frontend npm run lint/typecheck/build đạt ở bản sao source/lockfile ngoài iCloud, build còn cảnh báo chunk >500 kB; git diff --check đạt. Docker legacy build context gốc bị chờ iCloud, dừng đúng tiến trình do agent tạo rồi build context sạch ở /private/tmp: image ARM64 local build thành công, pip check đạt; chạy không env dừng trước migration như mong đợi. Chưa chạy image trên Render/DB Neon, không dùng kết quả này thay nghiệm thu hosted.
- Scan các file deployment/config (manifest, Ignition journal/artifacts/build-info, render.yaml, vercel.json, startup) không thấy các private key/MASTER_KEY/JWT/full RPC URL đã cấu hình. Env thật được Git bỏ qua. Scan rộng cả repo bị chờ iCloud nên đã dừng, không tuyên bố đã quét toàn bộ source. Docker và DB local được giữ chạy.
- Nini chưa có tài khoản hosting. Đã hướng dẫn tạo Neon Free trước; đang chờ tài khoản/project và DATABASE_URL mới. Không tự tạo tài khoản, nhập thẻ, chọn trial/paid hoặc commit/push để deploy. Render cần source local mới được Nini duyệt đưa lên remote hoặc cách phân phối khác được chấp thuận. Còn các mục 4–10 trong checkpoint docs/deployments/STEP08-PROGRESS.md; chưa hoàn tất bước 08 và chưa tự tick CODE.md.

### Kết nối PostgreSQL Neon — 26/11/2026

- Nini đã tạo project Free Singapore, branch production, database neondb, Direct connection và tự điền DATABASE_URL vào .env.hosting với driver postgresql+psycopg. File env thật vẫn được Git bỏ qua.
- Kiểm tra trước migration: host thuộc neon.tech, không pooler/local, database neondb, có mật khẩu thật và sslmode=require. Kết nối thật đạt, database ban đầu không có bảng. Alembic upgrade head thành công, revision 0003; bảng gồm alembic_version, auth_nonces, sessions, document_grants, documents. Không reset/drop hoặc seed DB deploy, không truy cập DB local.
- Kiểm TLS ở psycopg pgconn.ssl_in_use=True. pg_stat_ssl phía database là False (chặng proxy nội bộ); không đánh đồng với việc kết nối client không được mã hóa. Log migration giữ riêng ngoài repo, không in credentials.
- Chưa có backend HTTPS; cần Nini đăng ký Render Free/Vercel Hobby, đồng thời giải quyết source local chưa push trước Git-based deployment. Chưa nghiệm thu API/ACL/IPFS trên bản hosted. Cập nhật checkpoint STEP08-PROGRESS.md, không tự tick CODE.md, commit hoặc push.

## Kết quả bước 01

Chỉ tạo báo cáo này. Không thay code nghiệp vụ, fixture, cấu hình môi trường hoặc dữ liệu chain/DB. Không commit/push/merge. Chưa có kết quả test/build/browser/deploy mới để báo Pass hoặc chấm điểm.
