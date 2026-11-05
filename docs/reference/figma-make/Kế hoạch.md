KẾ HOẠCH TRIỂN KHAI CHI TIẾT

HỆ THỐNG TRUY XUẤT NGUỒN GỐC THỰC PHẨM (FOOD TRACEABILITY)

Bài tập 07 • Môn Công nghệ Blockchain  
 Phiên bản 2.2 • Rev.04 • 20/10/2026

## **Mục tiêu**

Xây dựng DApp quản lý lô dừa nguyên trái từ Farmer qua Logistics đến Retailer; người tiêu dùng truy xuất bằng QR. Một NFT đại diện cho một lô. Sản phẩm phải có hợp đồng chạy trên Sepolia, hồ sơ trên IPFS, mã hóa tài liệu riêng và cảm biến giả lập bằng Python/Web3.py.

## **Cách sử dụng kế hoạch**

Mỗi giai đoạn có thứ tự công việc, sản phẩm bàn giao và điều kiện hoàn thành. Chỉ đánh dấu hoàn thành khi có minh chứng chạy thật. Đây là kế hoạch triển khai, không phải kết quả kiểm thử hoặc cam kết điểm số.

Repository: https\://github.com/2nguyen3/food-supply-chain-traceability

Bảng theo dõi công việc trên GitHub: docs/plan/plan.xlsx. Nội dung, phân công và trạng thái lấy từ bảng Excel của nhóm; cập nhật tiến độ khi có đầu ra được kiểm chứng. Việc bổ sung yêu cầu vào kế hoạch không tự đánh dấu công việc triển khai đã hoàn thành.

## **Vị trí hiện tại**

Đã chọn đề tài và thống nhất hướng làm. Bước tiếp theo là Giai đoạn 02: khóa thiết kế dữ liệu, hàm contract và cấu trúc dự án. Bản chốt dùng Python (FastAPI) \+ PostgreSQL, Bearer token và triển khai web qua HTTPS; trang trace đọc trực tiếp RPC/IPFS, không dùng DB lưu event. Rev.03 bổ sung sơ đồ quy trình, lô cố định 1.000 kg, chứng chỉ gốc cho Consumer và diễn tập demo; giữ kiến trúc của bản chốt. Trạng thái triển khai phải được cập nhật theo mã nguồn thực tế; chưa mặc định các tính năng đã hoàn thành.

 

# **1\. Phạm vi và ưu tiên**

## **1.1 Phạm vi chốt**

Quản lý nguyên lô, không chia/gộp lô; không thanh toán, marketplace hoặc phần cứng IoT thật. Farmer tạo lô; Logistics nhận và ghi vận chuyển; Retailer kiểm hồ sơ, nhận hàng, bán hết và báo sự cố. Consumer đọc không cần ví qua trang web công khai (frontend được triển khai lên hosting có HTTPS). Quy ước cố định: 1 lô \= 1 tấn \= 1.000 kg (quantityKg \= 1000), tương ứng một NFT. Không chia hoặc gộp khối lượng sau mint.

## **1.2 Bắt buộc để hoàn thành đề**

·      F01–F07: vai trò, tạo lô/NFT, bàn giao, vận chuyển, bán hết, QR và tài liệu có quyền.  
·      Python/Web3.py gửi dữ liệu nhiệt độ; cảnh báo cơ bản F08; truy ngược và tìm lô liên quan F09; Retailer báo sự cố F10. Các phần này thuộc yêu cầu nghiệp vụ, không gắn nhãn mở rộng thuần.  
·      Có mint và transfer NFT; 3 loại file PDF, ảnh, JSON; AES-GCM; triển khai testnet; kiểm thử và báo cáo có minh chứng.

## **1.3 Nên có và được cắt**

Nên có: biểu đồ nhiệt độ đẹp, bộ lọc lịch sử, xuất báo cáo tổng hợp. Cắt trước nếu thiếu thời gian: hết hạn yêu cầu bàn giao, quy trình thay ví đang giữ lô, khôi phục vai trò và bọc khóa RSA/ECIES.

Điểm mở rộng thực sự: bàn giao hai bên, thu hồi cả lô Sold, quyền từng tài liệu và đăng nhập chống phát lại. Không mở rộng trước khi luồng chính chạy ổn.

 

# **2\. Đối chiếu rubric và minh chứng**

Bảng 1\. Kế hoạch đáp ứng năm tiêu chí

| Tiêu chí | Minh chứng phải có |
| :---- | :---- |
| Smart contract | ≥3 nghiệp vụ; ≥2 ràng buộc; test quyền/trạng thái; giải thích kỹ thuật chặn bằng code; địa chỉ contract, giao dịch Sepolia và bảng kết quả bộ ca đã chạy trên Sepolia (Bảng 15). |
| DApp / Web3.py | Giao diện có ≥3 tương tác on-chain, tx hash và receipt; script Python ghi cảm biến; demo mã hóa/giải mã; luồng demo ổn định trên bản đã triển khai. |
| IPFS | Upload và retrieve PDF, ảnh, JSON; CID; so sánh hash; kiểm soát truy cập theo vai trò (RBAC, Bảng 4); thử tài liệu riêng bằng ví được cấp và ví bị từ chối. |
| NFT | Mint khi tạo lô; transfer khi nhận bàn giao; tokenURI ipfs://CID; ownership history từ Transfer. |
| Báo cáo | Hình/bảng có caption, trích dẫn, bảng viết tắt; chữ Word 15 pt, slide tối thiểu 20 pt; video có phụ đề. |

Rubric có năm tiêu chí, mỗi tiêu chí tối đa 10 điểm. Mục tiêu là cung cấp bằng chứng cho mức đánh giá cao nhất, không suy ra chắc chắn được 50/50.

Ca cố ý revert nằm trong phiên kiểm thử riêng; demo chính dùng dữ liệu hợp lệ để hạn chế lỗi thao tác. Không xóa hoặc che kết quả kiểm thử thất bại.

Căn cứ: đề bài \[1\] và rubric của giảng viên \[2\], là tệp bảng tính Excel (Rubik.xlsx) do sinh viên cung cấp. Các tiêu chí nêu trong bảng này lấy từ rubric; các điều kiện nội bộ của nhóm được ghi rõ là nội bộ (mục 28.3).

 

# **3\. Bộ công nghệ đã chốt**

Bảng 2\. Thành phần và lựa chọn

| Thành phần | Công nghệ và mục đích |
| :---- | :---- |
| Frontend | React 19 \+ TypeScript \+ Vite 7; CSS thuần; ethers 6; qrcode.react; Recharts cho biểu đồ. |
| Blockchain | Solidity 0.8.28; OpenZeppelin Contracts 5.4.0; ERC721URIStorage, AccessControl, ReentrancyGuard. |
| Dev/test contract | Hardhat 3, TypeScript, bộ plugin hardhat-toolbox-mocha-ethers; Mocha/Chai; Ignition triển khai. |
| Backend | Python 3.12; FastAPI \+ Uvicorn; Pydantic 2; SQLAlchemy 2 \+ Alembic; psycopg 3; cryptography (AES-GCM); eth-account (xác thực chữ ký ví); web3.py (đọc chain); httpx (gọi Pinata). |
| Lưu trữ | PostgreSQL cho phiên/nonce/tài liệu riêng/ACL (một DB cho bản triển khai); Pinata Public IPFS cho file công khai và ciphertext. Không dùng Supabase. |
| IoT | Python 3.12; web3.py 7.13.0; python-dotenv; dữ liệu cảm biến từ CSV. |
| Mạng / ví | Hardhat local trước; Ethereum Sepolia sau; MetaMask; RPC Sepolia từ Alchemy. |
| Kiểm thử API | pytest \+ FastAPI TestClient/httpx trên PostgreSQL thử nghiệm; kiểm thử DApp theo checklist trình duyệt. |
| Triển khai web | Frontend: build Vite, host tĩnh có HTTPS. Backend: container (Dockerfile) trên nền tảng PaaS có HTTPS; PostgreSQL do nền tảng cấp. Chọn nhà cung cấp lúc triển khai và kiểm điều khoản gói miễn phí tại thời điểm đó. |
| Dev cục bộ (tùy chọn) | Docker Compose chỉ để chạy PostgreSQL trên máy từng người khi phát triển/test; không dùng để triển khai, không dùng chung DB giữa các máy. |

Đây là bộ phiên bản mục tiêu, không phải bộ đã được cài/chạy trong tài liệu. Khóa patch thực tế bằng package-lock.json (contracts, frontend) và requirements.lock (backend, iot) sau smoke test. Không nâng major giữa đồ án. Hardhat 3 dùng cấu hình ESM, không sao chép cấu hình Hardhat 2 \[6–8\].

 

# **4\. Kiến trúc và ranh giới dữ liệu**

## **4.1 Các luồng kết nối**

·      React → MetaMask → RPC → contract: ký và gửi giao dịch nghiệp vụ. Backend không giữ khóa Farmer/Retailer để ký hộ.  
·      React → FastAPI → Pinata/IPFS: tải file lên, kiểm quyền, giải mã tài liệu riêng. Backend kiểm vai trò bằng cách đọc contract.  
·      Python → RPC → contract: ví Logistics ký recordTransit; DApp đọc cùng sự kiện để hiển thị.  
·      React → RPC: đọc trạng thái, tokenURI và Transfer. Trang trace công khai chỉ đọc RPC và IPFS, không phụ thuộc backend hay DB.  
·      FastAPI → PostgreSQL: lưu nonce, phiên, tài liệu riêng và ACL. Đây là dữ liệu vận hành, không phải nguồn sự thật về chủ sở hữu hay trạng thái lô.

## **4.2 Lưu ở đâu**

On-chain: mã lô, nông trại, nhóm thu hoạch, ngày, chủ thể, trạng thái, hash hồ sơ, CID metadata, bàn giao, báo sự cố và thu hồi. Events chứa dữ liệu theo dõi để dựng timeline.

IPFS công khai: chứng nhận PDF mẫu, ảnh lô, metadata JSON; hóa đơn riêng chỉ đưa bản mã lên. Không ghi thông tin cá nhân thật vào dữ liệu demo.

PostgreSQL: nonce đăng nhập, phiên, tài liệu riêng, ACL và khóa dữ liệu đã bọc. Không có bảng tài khoản: danh tính là địa chỉ ví, vai trò đọc từ contract. Không dùng DB làm nguồn quyết định ownerOf hoặc trạng thái lô, và không lưu cache event.

## **4.3 Giới hạn cần trình bày**

Blockchain chứng minh dữ liệu đã ghi và người ký, không chứng minh chất lượng thực phẩm ngoài đời. IPFS cần pin và kiểm tra truy xuất; CID không tự đảm bảo file tồn tại mãi. Backend giữ khóa giải mã là thành phần được tin cậy; dịch vụ host backend/DB cũng là bên thứ ba được tin cậy, và gói miễn phí có thể giới hạn dung lượng, ngủ khi không dùng hoặc không tự sao lưu.

 

# **5\. Vai trò và mô hình trạng thái**

Bảng 3\. Vai trò nghiệp vụ

| Vai trò | Phạm vi thao tác |
| :---- | :---- |
| Admin | Cấp/thu hồi vai trò; xem xét sự cố; thu hồi lô có lý do. Không mặc nhiên được đọc hóa đơn. |
| Farmer | Tạo lô thuộc farmId được Admin gán; tạo hồ sơ; đề nghị giao Logistics. |
| Logistics | Chấp nhận lô được chỉ định; ghi cảm biến khi đang giữ; đề nghị giao Retailer. |
| Retailer | Kiểm hồ sơ, nhận đúng lô; bán hết; báo sự cố kể cả sau Sold. |
| Consumer | Tra cứu công khai; xem chứng chỉ gốc PDF/ảnh và ảnh lô qua liên kết IPFS; không cần đăng nhập hoặc kết nối ví. |

RBAC có hai lớp. Lớp on-chain (AccessControl: onlyRole kết hợp kiểm chủ sở hữu hiện tại và lifecycle) quyết định ai được ghi dữ liệu. Lớp off-chain (ACL từng tài liệu trong PostgreSQL) quyết định ai đọc được tài liệu riêng và luôn kiểm lại vai trò on-chain. Bảng 4 là ma trận vai trò × tài nguyên dùng để viết test và báo cáo.

 

## **5.1 Ma trận quyền và trạng thái hiệu lực**

Bảng 4\. Ma trận quyền theo vai trò

| Tài nguyên / thao tác | Vai trò được phép và nơi kiểm |
| :---- | :---- |
| Cấp/thu hồi vai trò, gán farmId, recallBatch | Admin. On-chain: onlyRole(ADMIN\_ROLE). |
| createBatch | Farmer có farmId do Admin gán. On-chain. |
| requestTransfer / cancelTransfer | Chủ hiện tại của lô (Farmer hoặc Logistics) theo đúng tuyến. On-chain. |
| acceptTransfer / rejectTransfer | Người nhận được chỉ định (Logistics hoặc Retailer) còn giữ vai trò đúng. On-chain. |
| recordTransit | Logistics đang giữ lô ở trạng thái InTransit. On-chain. |
| markSold / reportIncident | Retailer đang giữ lô (reportIncident cả sau Sold). On-chain. |
| Hồ sơ công khai (PDF mẫu, ảnh, metadata JSON) | Mọi người, kể cả Consumer không cần ví. IPFS công khai. |
| Hóa đơn giá mua sỉ (tài liệu riêng) | Uploader (Farmer) và ví được grant: Logistics và Retailer của lô demo. Farmer B, Admin và Consumer bị từ chối. Off-chain: phiên \+ vai trò on-chain \+ ACL. |

Trạng thái lưu: Created → InTransit → Delivered → Sold. Farmer→Logistics được chấp nhận mới chuyển InTransit; Logistics→Retailer được chấp nhận mới chuyển Delivered. Request chưa làm đổi chủ hoặc trạng thái.

Expired là trạng thái hiệu lực tính từ block.timestamp ≥ expiryDate, không cần giao dịch chạy đúng thời khắc hết hạn. Giữ lifecycle gốc để biết lô hết hạn trước hay sau khi bán. UI hiển thị đồng thời nhãn hết hạn và trạng thái gốc.

recalled là cờ độc lập, không ghi đè lịch sử. Sold vẫn có thể bị thu hồi. NFT giữ ở Retailer sau Sold, đại diện đơn vị chịu trách nhiệm cuối, không khẳng định quyền sở hữu pháp lý của khách hàng.

 

# **6\. Chức năng và ánh xạ với đề**

Bảng 5\. Mã chức năng

| Mã | Nội dung và đầu ra |
| :---- | :---- |
| F01 | Vai trò và farmId; cấp/thu hồi có event. |
| F02 | Tạo lô \+ mint NFT \+ tokenURI cùng giao dịch. |
| F03 | request / accept / reject / cancel bàn giao. |
| F04 | Ghi vận chuyển, nhiệt độ, thời gian và vị trí. |
| F05 | Đánh dấu bán hết sau Delivered. |
| F06 | Tra cứu QR; timeline và ownership history, mỗi mốc kèm txHash và link Etherscan.; xem chứng chỉ gốc và ảnh lô trực tiếp từ IPFS không cần ví. |
| F07 | PDF/ảnh/JSON; mã hóa và ACL tài liệu riêng. |
| F08 | Phát hiện vượt ngưỡng; đồ thị là phần nâng cao. |
| F09 | Truy về farm/nhóm thu hoạch; đề xuất lô liên quan; thu hồi. |
| F10 | Retailer ghi nhận sự cố và bằng chứng IPFS. |

Bảng 6\. Hàm của đề và hàm hiện thực

| Trong đề | Trong dự án |
| :---- | :---- |
| harvestProduct | createBatch: tạo lô và mint NFT. |
| updateTransitStatus | recordTransit: ghi thông tin vận chuyển/cảm biến. |
| receiveAndVerify | acceptTransfer: nhánh Retailer so sánh hash rồi mới Delivered. |

Không cần viết thêm hàm trùng nghiệp vụ chỉ để giữ tên; bảng ánh xạ này phải có trong báo cáo và slide.

 

# **7\. Critical Tracking Events**

Bảng 7\. Các mốc truy vết cần lưu

| Mốc / event | Dữ liệu và ý nghĩa |
| :---- | :---- |
| BatchCreated | batchId/tokenId, farmer, farmId, harvestGroupId, ngày, metadataCID/hash; nguồn gốc. |
| TransferRequested | requestId, tokenId, from, to; đề nghị, chưa đổi chủ. |
| TransferAccepted | requestId, tokenId, người nhận, hash kiểm tra; bàn giao thành công. |
| Transfer | ERC-721: from, to, tokenId; nguồn lịch sử sở hữu, bao gồm mint từ zero address. |
| TransitRecorded | tokenId, readingId, tempCenti, observedAt, location; ví ký và thời gian block. |
| BatchSold | tokenId, Retailer, thời điểm; kết thúc luồng thương mại của nguyên lô. |
| IncidentReported | incidentId, tokenId, Retailer, reportCID/hash; báo sự cố tại siêu thị. |
| BatchRecalled | tokenId, incidentId tham chiếu, Admin, reasonCID/hash; quyết định thu hồi một lô cụ thể. |

Reject/cancel và cấp/thu hồi vai trò là events bổ trợ. Mọi record lịch sử gắn chainId, contractAddress, txHash, blockNumber, transactionIndex, logIndex; lưu blockHash để kiểm tra lại khi đọc log.

Thời điểm đo do simulator cung cấp khác thời điểm ghi lên chain. Biểu diễn rõ cả hai; không gọi timestamp do thiết bị gửi là thời gian đã được blockchain xác thực.

 

# **8\. Thiết kế dữ liệu và NFT**

## **8.1 Cấu trúc contract**

·      Batch: tokenId, batchCode, farmId, farmLocation, harvestGroupId, quantityKg, harvestDate, expiryDate, lifecycle, recalled, metadataHash, certificateHash, imageHash. farmLocation là vị trí công khai của trang trại tại thời điểm tạo lô.  
·      PendingTransfer: requestId, tokenId, from, to, active. Mỗi lô tối đa một yêu cầu đang chờ; requestId tăng để chống chấp nhận yêu cầu cũ.  
·      Incident: incidentId, tokenId, reporter, reportCID, reportHash, timestamp. Báo cáo mới được thêm, không sửa xóa báo cáo cũ. incidentId là mã sự cố gốc được tham chiếu khi thu hồi.  
·      mapping mã lô → tokenId; mapping Farmer → farmId; mapping tokenId/readingId → đã dùng. tokenId bắt đầu từ 1 để 0 biểu thị không tồn tại.

quantityKg là uint256 và luôn bằng 1000 trong phạm vi đồ án. Contract kiểm tra giá trị này trong createBatch; frontend chỉ hiển thị khối lượng cố định. Metadata và seed\_demo.py cùng ghi quantityKg \= 1000, tránh khác nhau giữa hồ sơ và chain.

## **8.2 Hồ sơ và tokenURI**

Metadata JSON công khai có name, description, image \= ipfs://imageCID, batchCode, farmId, harvestGroupId, certificateURI, certificateSHA256, imageSHA256, schemaVersion, giống dừa (cultivar), loại phân bón (fertilizer), vị trí trang trại và ngưỡng nhiệt độ bảo quản (min/max). Lưu nguyên byte JSON được upload để tính metadataHash; không parse rồi stringify khi xác minh.

createBatch nhận ba hash SHA-256 dạng bytes32 và metadataCID. tokenURI trả ipfs://metadataCID, không trả link gateway phụ thuộc nhà cung cấp. Metadata và ba hash bất biến trong phạm vi đồ án; bổ sung sự cố bằng event riêng.

Không đặt metadataHash vào chính JSON đang băm vì gây tham chiếu vòng. Không dùng CID thay SHA-256 của file: cấu trúc CID/IPFS có thể bao gồm định dạng và DAG \[5\].

 

# **9\. Contract: các hàm phải viết**

Bảng 8\. Hợp đồng giao diện nghiệp vụ

| Hàm | Đầu vào / kết quả |
| :---- | :---- |
| createBatch | Thông tin lô \+ CID \+ 3 hash; kiểm Farmer/farmId, mã duy nhất, quantityKg \= 1000 (1 tấn), ngày hợp lệ; mint cho Farmer. |
| requestTransfer | tokenId, to; kiểm chủ hiện tại và tuyến; tạo requestId; chưa Transfer. |
| acceptTransfer | tokenId, requestId, hashes; đúng người nhận; đối chiếu 3 hash; cập nhật trạng thái và chuyển NFT. |
| rejectTransfer | tokenId, requestId; đúng người nhận; đóng yêu cầu. |
| cancelTransfer | tokenId, requestId; đúng người gửi; đóng yêu cầu. |
| recordTransit | tokenId, readingId, tempCenti, observedAt, location; ghi event. |
| markSold | tokenId; Retailer đang giữ, Delivered, chưa hết hạn/thu hồi. |
| reportIncident | tokenId, reportCID, reportHash; Retailer đang giữ, Delivered hoặc Sold. |
| recallBatch | tokenId, incidentId, reasonCID/hash; Admin, lô tồn tại, chưa thu hồi; incidentId phải là sự cố đã ghi. Sự cố có thể thuộc lô khác; việc liên quan (cùng farmId/nhóm thu hoạch) do Admin xét ngoài chuỗi và nêu trong lý do. |

Read methods: getBatch, getPendingTransfer, isExpired, ownerOf, tokenURI, hasRole. Không lặp toàn bộ danh sách lô trong một giao dịch; tìm lô liên quan ngoài chuỗi rồi thu hồi từng lô.

 

# **10\. Ràng buộc và cách hiện thực**

Bảng 9\. Quy tắc và kỹ thuật bảo vệ

| Quy tắc | Cách làm và điều cần test |
| :---- | :---- |
| BR01 / BR02 | onlyRole(FARMER\_ROLE); farmId từ mapping do Admin quản lý; mã lô duy nhất; quantityKg \== 1000; harvestDate≤now\<expiryDate. |
| BR03 / BR04 | Một mã lô/một NFT; ownerOf; chỉ Farmer→Logistics→Retailer; kiểm vai trò cả hai tại accept, không chỉ tại request. |
| BR05 | Modifier/check dùng chung chặn request, accept, recordTransit, markSold khi Sold/expired/recalled; reject/cancel vẫn được dọn yêu cầu. |
| BR06 | Logistics hiện đang sở hữu, lifecycle=InTransit; readingId chưa dùng; thời điểm không vượt hiện tại và không lùi so với lần trước. |
| BR07 | Thu hồi có lý do, incidentId hợp lệ và event; không xóa provenance; reportIncident/recall được phép sau Sold hoặc hết hạn. Test: incidentId không tồn tại → revert; lô khác nhóm không tự bị thu hồi. |
| BR08 | Hash nhận đúng bộ 3 đã lưu mới đổi chủ; sai một hash thì revert nguyên giao dịch. |

Chặn đường vòng ERC-721: override transferFrom và safeTransferFrom bản 4 tham số để revert; bản 3 tham số của OpenZeppelin 5.4.0 gọi vào bản 4 tham số nên cũng bị chặn. Chỉ acceptTransfer gọi \_safeTransfer nội bộ sau kiểm nghiệp vụ. Vô hiệu hóa approve/setApprovalForAll; không có hàm chuyển hộ Admin.

OpenZeppelin 5 cập nhật sở hữu qua \_update \[4\]. Phương án chính giữ \_update của thư viện, không cần gate mở khóa: chặn các entrypoint công khai và kiểm mọi caller nội bộ. Dùng nonReentrant cho các hàm ghi nghiệp vụ; đóng pending/cập nhật trạng thái trước callback, revert sẽ rollback toàn bộ. Test cả hai overload safeTransferFrom và bên nhận contract độc hại.

 

# **11\. Kiểm tra hồ sơ khi nhận hàng**

## **11.1 Trình tự bắt buộc**

·      1\. Đọc tokenURI và ba hash từ contract đúng chain/address; lấy thông tin yêu cầu bàn giao đang active.  
·      2\. Tải nguyên byte metadata JSON từ IPFS; SHA-256 bằng crypto.subtle.digest; so sánh metadataHash trước khi tin nội dung JSON.  
·      3\. Từ JSON đã xác minh, tải PDF và ảnh; tính SHA-256 trên ArrayBuffer gốc. Không băm tên file, URL hay ảnh đã resize.  
·      4\. UI hiển thị ba kết quả; khi có lỗi tải/hash sai thì khóa nút nhận, giữ quyền thử tải lại.  
·      5\. Người nhận ký acceptTransfer(tokenId, requestId, computedHashes). Contract kiểm quyền/trạng thái và so sánh toàn bộ hash.  
·      6\. Receipt thành công mới hiển thị Delivered với Retailer; cập nhật ownerOf, Transfer và timeline. Nếu revert, chủ và trạng thái không đổi.

## **11.2 Ý nghĩa và giới hạn**

Cùng quy trình xác minh áp dụng cho Logistics khi nhận lần đầu để thống nhất API. Nhánh nhận của Retailer là receiveAndVerify theo đề.

Contract chỉ biết hash được gửi bằng giá trị đã lưu; người gọi có thể sao chép hash công khai mà không tải file. Vì vậy đây là đối chiếu dữ liệu và xác nhận có chữ ký của người nhận, không phải bằng chứng mật mã rằng file đã được đọc hay thực phẩm an toàn.

Ca chứng minh: thay một byte trong file mẫu → frontend phát hiện; gọi trực tiếp hàm với hash sai → contract revert. Không tuyên bố các phép kiểm này loại bỏ được mọi gian lận.

 

# **12\. Lộ trình tám giai đoạn**

Bảng 10\. Mốc theo dõi dự án

| Giai đoạn | Đầu ra và điều kiện chuyển bước |
| :---- | :---- |
| 01\. Phạm vi | Chọn đề, xác định nguyên lô và tiêu chí. Đã thống nhất hướng; rà lại với nhóm. |
| 02\. Thiết kế | Chốt stack (React, Python/FastAPI, PostgreSQL), use case, schema, state diagram, API, repo. Đây là bước cần làm ngay. |
| 03\. Contract | Contract \+ tests local; mint→2 lần bàn giao→Sold; ca chặn đều có test. |
| 04\. IPFS/bảo mật | 3 file upload/retrieve; AES-GCM; login và ACL trên PostgreSQL; test từ chối đúng. |
| 05\. DApp | Các màn hình nối contract/API; QR; receipt; nhận hàng có verify. |
| 06\. IoT/truy ngược | Python ghi nhiệt độ; Retailer báo sự cố; tìm nguồn và thu hồi. |
| 07\. Tích hợp/testnet/triển khai | Triển khai Sepolia; deploy frontend/backend; seed 4 lô; chạy end-to-end trên bản đã triển khai; lưu địa chỉ, CID, tx và kết quả test. |
| 08\. Báo cáo/demo | Báo cáo, slide, video phụ đề, source release; đối chiếu đủ năm tiêu chí. |

Khung dự kiến 6 tuần: tuần 1 \= 01–02; tuần 2 \= 03; tuần 3 \= 04; tuần 4 \= 05; tuần 5 \= 06–07; tuần 6 \= 08 và dự phòng. Đây là ước lượng tổ chức, cần cập nhật theo số thành viên và lịch nộp thực tế.

Trong GitHub Projects dùng Todo / Doing / Review / Done. Mỗi issue ghi F/BR/test liên quan, đầu ra, người phụ trách và đường dẫn minh chứng; không đánh dấu Done chỉ vì đã có giao diện.

 

# **13\. GĐ02: chuẩn bị môi trường**

## **13.1 Thứ tự trong buổi đầu**

·      1\. Cài Git, Node 22 ≥22.13, Python 3.12 và VS Code; Docker Desktop là tùy chọn, chỉ để chạy PostgreSQL cục bộ. Kiểm tra node \--version, npm \--version, python3 \--version, git \--version; ghi vào docs/environment.md.  
·      2\. Tạo repo food-supply-chain-traceability; thêm README.md, .gitignore và .env.example. Bỏ qua .env, node\_modules, .venv, dump database, khóa và output build.  
·      3\. Tạo năm thư mục contracts, frontend, backend, iot, docs; dùng npm package riêng cho contracts và frontend, môi trường venv riêng cho backend và iot để cô lập dependency.  
·      4\. Khởi tạo Hardhat 3 trong contracts bằng npx hardhat@3 \--init; chọn TypeScript \+ Mocha \+ ethers. Cài @openzeppelin/contracts@5.4.0; đặt compiler 0.8.28; chạy bài test mẫu.  
·      5\. Tạo frontend bằng npm create vite@7 frontend \-- \--template react-ts từ repo root; cài dependencies và chạy trang mẫu. Bổ sung ethers@6, qrcode.react và recharts; kiểm React 19 và Vite 7 trong package.json trước khi khóa bản cài.  
·      6\. Trong backend: python3 \-m venv .venv; cài fastapi, uvicorn\[standard\], pydantic, sqlalchemy, alembic, psycopg\[binary\], cryptography, eth-account, web3==7.13.0, httpx, python-multipart, python-dotenv; dev: pytest. Tạo PostgreSQL cục bộ (docker compose up \-d db hoặc cài trực tiếp), đặt DATABASE\_URL, chạy alembic upgrade head; pip freeze \> requirements.lock.  
·      7\. iot: python3 \-m venv .venv; kích hoạt môi trường; pip install web3==7.13.0 python-dotenv; pip freeze \> requirements.lock.

Đầu ra: contracts và frontend cài được, backend khởi động và trả /health, Python import Web3 được, contract mẫu test xanh. Commit lockfiles; ghi rõ đây là smoke test môi trường, chưa phải nghiệm thu nghiệp vụ.

 

# **14\. GĐ02: cấu trúc và cấu hình**

Bảng 11\. Các file cần tạo

| Thư mục | File chính |
| :---- | :---- |
| contracts/ | contracts/FoodTraceability.sol; test/FoodTraceability.ts; ignition/modules/FoodTraceability.ts; scripts/export-config.ts. |
| frontend/src/ | pages/; components/; lib/contract.ts; lib/hash.ts; lib/api.ts; config/deployment.json; abi/FoodTraceability.json. |
| backend/ | app/main.py; config.py; db.py; models.py; schemas.py; auth.py; documents.py; crypto.py; ipfs.py; chain.py; alembic/ (migrations); tests/; Dockerfile; requirements.lock. |
| iot/ | simulate.py; readings.csv; requirements.lock; .env.example. |
| docs/ | requirements.md; design.md; api.md; test-cases.md; evidence/; deployments/sepolia.json. plan/plan.xlsx (bảng theo dõi công việc của nhóm). |
| Gốc repo | docker-compose.yml (tùy chọn, chỉ PostgreSQL cục bộ); .env.example; scripts/seed\_demo.py (tạo 4 lô demo và hồ sơ mẫu); README.md. |

Quy ước backend: các module Python nằm trong backend/app/; Alembic, tests, Dockerfile và requirements.lock nằm trực tiếp dưới backend/. Frontend cần VITE\_PUBLIC\_RPC\_URL cho trang trace không có ví; URL/key này được coi là công khai và phải giới hạn quota/origin.

 

## **14.1 Biến môi trường**

Frontend chỉ có dữ liệu công khai: VITE\_CHAIN\_ID, VITE\_CONTRACT\_ADDRESS, VITE\_API\_BASE\_URL, VITE\_IPFS\_GATEWAY. Nếu RPC browser cần key thì coi key đó có thể bị nhìn thấy; giới hạn quota/origin.

Backend: RPC\_URL, CONTRACT\_ADDRESS, CHAIN\_ID, DEPLOY\_BLOCK, PINATA\_JWT, MASTER\_KEY, DATABASE\_URL, ALLOWED\_ORIGIN, AUTH\_DOMAIN, TOKEN\_TTL\_MINUTES (chốt 20). AUTH\_DOMAIN khớp domain frontend và nằm trong thông điệp ký. iot: RPC\_URL, CONTRACT\_ADDRESS, CHAIN\_ID, LOGISTICS\_PRIVATE\_KEY. Khóa deploy lưu riêng phía contracts.

Không đưa secret vào biến VITE\_\* hoặc Git. Tạo .env.example chỉ chứa tên biến và giá trị giả. Bản triển khai đặt secret trong cấu hình của nền tảng; MASTER\_KEY của bản triển khai khác với bản cục bộ. Mỗi ví demo dùng testnet, không dùng seed phrase/ví tiền thật. Tạo ít nhất năm ví độc lập (Admin, Farmer A, Farmer B, Logistics, Retailer) và ghi địa chỉ công khai vào manifest.

 

# **15\. GĐ02: hoàn thành thiết kế**

## **15.1 Các việc trước khi code nghiệp vụ**

·      1\. Viết use case theo vai trò: tác nhân, tiền điều kiện, bước chính, lỗi và hậu điều kiện; liên kết F01–F10.  
·      2\. Vẽ state diagram gồm lifecycle, cờ recalled và expiry suy ra; làm rõ request không đổi owner. Đồng thời hoàn thiện sơ đồ quy trình trồng trọt → thu hoạch/đóng gói → vận chuyển → bán lẻ → người tiêu dùng tại mục 15.3; xác định hoạt động ngoài chuỗi và các CTE on-chain.  
·      3\. Chốt struct, hàm và events theo mục 7–10; chốt quantityKg \= 1000 cho mọi lô demo; thống nhất đơn vị kg, nhiệt độ centi-°C, Unix seconds UTC.  
·      4\. Vẽ ERD PostgreSQL: auth\_nonces, sessions, documents, document\_grants; ghi khóa chính, unique key, foreign key và index. Không có bảng tài khoản và không có bảng cache event.  
·      5\. Phác màn hình Farmer, Logistics, Retailer, Admin, trang trace công khai; xác định nút nào gọi chain và nút nào gọi API.  
·      6\. Tạo test-cases.md trước; mỗi BR phải có ca thành công và bị từ chối. Chuẩn bị bốn lô ở mục 25\.

## **15.2 API thống nhất**

POST /auth/challenge; POST /auth/verify (trả access token); POST /auth/logout; POST /documents; POST /documents/{id}/bind; GET /documents/{id}/content; POST /documents/{id}/grants; DELETE /documents/{id}/grants/{wallet}; GET /health. Các endpoint tài liệu và logout cần Authorization: Bearer; challenge/verify/health không yêu cầu token. OPTIONS preflight được CORS xử lý; các request nghiệp vụ vẫn phải kiểm quyền. Trang trace công khai không gọi API.

Upload trước mint tạo draft thuộc uploader. Sau receipt thành công, gọi POST /documents/{id}/bind với tokenId và txHash. Backend kiểm đúng chain/contract, receipt thành công và BatchCreated khớp uploader, tokenId, CID/hash của draft trước khi bind nguyên tử; bind lặp cùng dữ liệu trả cùng kết quả, bind sang lô khác bị chặn. Với tài liệu bổ sung sau mint (hóa đơn, báo cáo sự cố), backend kiểm vai trò và quyền trên lô tương ứng, không yêu cầu giao dịch BatchCreated mới.

Điều kiện hoàn thành: người viết UI, contract, backend và IoT cùng dùng một schema; có ví dụ request/response và danh sách custom errors.

 

## **15.3 Sơ đồ quy trình từ trồng trọt đến người tiêu dùng**

**![][image1]**

Hình 1\. Quy trình nghiệp vụ từ nông trại đến người tiêu dùng.

Trồng trọt: Farmer ghi nhận giống, phân bón và vị trí nông trại trong hồ sơ ngoài chuỗi; không tạo giao dịch cho từng hoạt động canh tác. Thu hoạch/đóng gói: tạo hồ sơ IPFS và createBatch để mint NFT cho lô 1.000 kg (CTE: BatchCreated, Transfer từ zero address).

Vận chuyển: request/accept bàn giao Farmer → Logistics; ghi nhiệt độ và vị trí bằng recordTransit. Bán lẻ: request/accept Logistics → Retailer; xác minh ba hash trước Delivered; markSold khi bán hết nguyên lô. Bàn giao được đối chiếu bằng Transfer và TransferAccepted.

Consumer: quét QR, xem lịch sử và chứng chỉ gốc trên IPFS; không nhận NFT trong mô hình demo. Khi phát hiện sự cố tại siêu thị, Retailer ghi reportIncident; Admin truy ngược theo farmId \+ harvestGroupId và thu hồi từng lô. CTE chi tiết ở mục 7; sơ đồ này thể hiện luồng nghiệp vụ, không thay thế sơ đồ trạng thái.

 

# **16\. GĐ03: xây dựng contract**

## **16.1 Thực hiện theo thứ tự**

·      1\. Tạo FoodTraceability kế thừa ERC721URIStorage, AccessControl, ReentrancyGuard; resolve supportsInterface theo các base class.  
·      2\. Khai báo roles; constructor cấp Admin cho ví triển khai. Viết thao tác gán Farmer/farmId, cấp/thu hồi vai trò có kiểm Admin.  
·      3\. Viết createBatch và read methods; mint/URI/hash phải hoàn tất trong một giao dịch. Test trùng mã, ngày sai, quyền sai.  
·      4\. Viết request/accept/reject/cancel; accept kiểm lại chủ, người nhận, vai trò, trạng thái và requestId; đóng request trước chuyển nội bộ.  
·      5\. Thêm kiểm 3 hash trong accept; dùng lỗi riêng HashMismatch để DApp giải thích. Không cập nhật Delivered trước khi các điều kiện đạt.  
·      6\. Viết recordTransit, markSold; sau đó reportIncident và recallBatch (kiểm incidentId tồn tại, không bắt buộc cùng tokenId). Thu hồi lô không tự xóa pending; accept phải chặn và người gửi được cancel.  
·      7\. Chặn transfer/approval ngoài nghiệp vụ; kiểm callback và reentrancy; chạy test direct transfer để chứng minh ràng buộc.  
·      8\. Viết Ignition module, export ABI/address/deployBlock; chạy deploy local và tạo lô từ script smoke test.

Đầu ra: source Solidity, ABI, test và log chạy. Đạt mốc khi toàn bộ test contract bắt buộc xanh, không chỉ compile được. Chưa chuyển sang Sepolia khi luồng local chưa ổn.

 

# **17\. GĐ04: IPFS và bộ hồ sơ**

## **17.1 Hồ sơ công khai**

·      1\. Chuẩn bị certificate.pdf, batch.jpg và metadata.json bằng dữ liệu mô phỏng, đánh dấu chứng nhận mẫu.  
·      2\. Backend giới hạn upload, ví dụ 10 MB/file; kiểm loại nội dung và quyền uploader. Không tin duy nhất extension.  
·      3\. Upload PDF và ảnh qua Pinata API với network=public; lấy CID. Tính SHA-256 trên byte gốc trước upload.  
·      4\. Tạo JSON tham chiếu hai CID và hash; lưu byte JSON chính xác, hash rồi upload. Gửi metadataCID \+ ba digest cho createBatch.  
·      5\. Retrieve cả ba qua gateway IPFS; đối chiếu hash trước khi sử dụng. Ghi CID, dung lượng, hash và loại MIME vào manifest thử nghiệm.

## **17.2 Hồ sơ riêng**

Hóa đơn mẫu được mã hóa trước khi upload. Public IPFS chỉ nhận ciphertext; không upload plaintext rồi mới tìm cách đặt quyền. CID của ciphertext có thể công khai nhưng người không có khóa không đọc được nội dung.

Pinata được dùng để pin lên mạng IPFS công khai; không dùng nhầm chế độ private mặc định của API \[9\]. JWT chỉ ở backend. Ghi lỗi upload rõ ràng, cho retry; không mint khi bộ hồ sơ chưa upload đủ.

Điều kiện hoàn thành: tải lại được ba loại file sau refresh, hash đúng; CID không bị coi là SHA-256. Có thử mất gateway và thông báo lỗi thay vì tự báo xác minh thành công.

 

# **18\. GĐ04: AES-GCM và quản lý khóa**

## **18.1 Mã hóa tài liệu riêng**

·      1\. Với từng file, sinh data key 32 byte ngẫu nhiên và IV 12 byte; AES-256-GCM bằng thư viện cryptography (AESGCM) của Python. Không tái sử dụng IV với cùng key.  
·      2\. Dùng AAD cố định gồm schemaVersion \+ documentId \+ uploader; lưu đúng byte AAD để giải mã. Thu tag 16 byte.  
·      3\. Đóng gói ciphertext, IV, tag, AAD/schemaVersion; đưa gói lên IPFS. Không đưa key vào gói.  
·      4\. Bọc data key bằng AES-GCM với MASTER\_KEY của backend và IV mới. PostgreSQL lưu wrappedKey \+ wrapIV \+ wrapTag, CID và chủ tài liệu.  
·      5\. Khi tải, kiểm phiên và ACL trước; backend lấy ciphertext, mở key, xác minh tag và giải mã; trả file qua HTTPS. Tag sai thì từ chối, không trả dữ liệu từng phần.

## **18.2 Chứng minh và giới hạn**

Demo: ví được cấp quyền đọc ra đúng file; ví khác gọi trực tiếp API nhận 403; sửa ciphertext/tag khiến giải mã thất bại. Lưu fingerprint/hash của file thử nghiệm để đối chiếu, không ghi khóa vào log.

MASTER\_KEY nằm ngoài DB và Git, cần backup riêng. Mất khóa thì không giải mã được. Backend có khả năng đọc nội dung, nên đây là mã hóa phía máy chủ có kiểm soát truy cập, không phải end-to-end.

AES-GCM là mã hóa đối xứng có xác thực \[10\]. RSA/ECIES bọc khóa theo từng người nhận chỉ là mở rộng sau cùng; khóa ký ví Ethereum không tự trở thành khóa RSA. Không thêm cơ chế này vào đường găng.

 

# **19\. GĐ04: đăng nhập và quyền file**

## **19.1 Chữ ký ví chống phát lại**

·      1\. Backend tạo nonce ngẫu nhiên, thời hạn 5 phút, gắn wallet, domain và chainId; lưu trạng thái chưa dùng.  
·      2\. Frontend hiển thị thông điệp gồm mục đích đăng nhập, nonce, domain, chainId, issuedAt và expirationTime; người dùng ký bằng ví.  
·      3\. Backend khôi phục địa chỉ bằng eth-account (encode\_defunct \+ recover\_message); đối chiếu toàn bộ thông điệp với challenge đã lưu; consume nonce bằng một câu UPDATE có điều kiện chưa dùng (nguyên tử trong PostgreSQL).  
·      4\. Tạo access token ngẫu nhiên, hiệu lực 20 phút; DB chỉ lưu hash token và expiry. Frontend giữ token trong bộ nhớ (không localStorage) và gửi qua Authorization: Bearer. CORS chỉ cho phép origin frontend (ALLOWED\_ORIGIN). Vì trình duyệt không tự đính kèm Bearer token, luồng này không dùng cơ chế CSRF token cho cookie; vẫn cần kiểm đầu vào và phòng XSS. CORS không thay thế xác thực hoặc ACL.  
·      5\. Logout xóa phiên. Khi đọc file, kiểm lại vai trò on-chain và ACL, không tin role đã lưu từ lần đăng nhập.

## **19.2 Quyền theo tài liệu**

documents có id, tokenId/draftId, uploader, visibility, CID và wrapped key. document\_grants có documentId, wallet, grantedBy, revokedAt. Chỉ uploader đang hợp lệ quản lý ACL tài liệu của mình; vai trò Admin không tự cấp quyền đọc cho mình. Tài liệu riêng mẫu là hóa đơn giá mua sỉ; danh sách grant demo ở Bảng 4\.

Người đọc cần phiên hợp lệ, vai trò được phép và grant còn hiệu lực (hoặc là uploader hợp lệ). Thu hồi grant chặn lần tải sau, không thu hồi được file đã tải. Nếu RPC lỗi, từ chối cấp nội dung riêng thay vì đoán quyền.

Điều kiện hoàn thành: test nonce dùng lại, sai domain, hết hạn, hai request dùng cùng nonce; truy cập chéo documentId; Admin không có grant; vai trò bị thu hồi sau khi đăng nhập.

 

# **20\. GĐ05: dựng DApp theo luồng**

## **20.1 Thứ tự màn hình**

·      1\. Trang trace công khai: nhập batchCode/tokenId, hiển thị nguồn gốc và trạng thái; phân biệt not found, đang tải, lỗi RPC. Có khu vực Hồ sơ công khai: hiển thị ảnh lô, xem chứng chỉ PDF gốc trong trình xem hoặc mở tab mới, và liên kết IPFS của chứng chỉ (ipfs://CID kèm URL gateway HTTPS). Consumer xem được không cần ví/token. Nếu chứng chỉ là ảnh, hiển thị ảnh gốc; nếu là PDF, không thay bản gốc bằng thumbnail. Hiển thị CID và báo rõ lỗi tải hoặc hash không khớp.  
·      2\. Kết nối MetaMask: kiểm chainId; hiện wallet/vai trò; lắng nghe accountsChanged và chainChanged, xóa dữ liệu phiên cũ khi đổi ví.  
·      3\. Farmer: form tạo lô, upload hồ sơ, xem hash/CID, gửi createBatch; hiện tokenId, tokenURI và QR sau receipt. Form hiển thị cố định “1 tấn (1.000 kg)”, không cho nhập khối lượng khác; gửi quantityKg \= 1000\.  
·      4\. Bàn giao: người gửi chọn đúng ví/tuyến; người nhận thấy pending request, chạy verify hồ sơ rồi accept; có reject/cancel.  
·      5\. Logistics: bảng lô đang giữ và lịch sử readings; chỉ cho thao tác đúng lô, nhưng contract vẫn là lớp kiểm quyền cuối.  
·      6\. Retailer: hồ sơ xác minh, markSold, reportIncident; Admin: vai trò, danh sách sự cố, lô liên quan, recall từng lô.

## **20.2 Xử lý giao dịch**

Mọi nút ghi chain đi qua chuỗi: kiểm input → chờ ví ký → đã gửi txHash → đang chờ receipt → thành công/thất bại. Khóa nút khi đang gửi; phân biệt người dùng từ chối ký với contract revert.

Không báo thành công chỉ vì nhận txHash. Sau receipt đọc lại contract để đồng bộ. Có link explorer Sepolia. Thêm npm scripts dev/build/test trong README; build phải thành công trước mốc tiếp theo.

 

# **21\. GĐ05: QR, events và lịch sử**

## **21.1 Lịch sử sở hữu**

Đọc event Transfer của ERC-721 từ deployBlock đến block hiện tại theo từng khoảng block; lọc tokenId. Bao gồm mint từ địa chỉ zero, Farmer→Logistics, Logistics→Retailer. Đối chiếu owner cuối với ownerOf \[3\].

Không lưu cache event trong DB. Trang trace đọc log trực tiếp từ RPC theo khoảng block từ deployBlock; sắp xếp blockNumber, transactionIndex, logIndex; khóa nhận diện chainId+contract+txHash+logIndex để không đếm trùng. Đọc lại một cửa sổ block gần nhất để xử lý reorg; dữ liệu chưa đủ xác nhận được đánh dấu tạm thời.

DB không tạo lịch sử sở hữu riêng; timeline luôn dựng lại từ contract. Khi RPC giới hạn eth\_getLogs, giảm khoảng block và tiếp tục từ block cuối đã đọc.

## **21.2 QR và tra cứu**

QR chứa URL /trace/{chainId}/{contractAddress}/{tokenId}; không chứa khóa, hóa đơn hay trạng thái có thể lỗi thời. Trang đọc dữ liệu mới để lô thu hồi sau Sold vẫn hiện cảnh báo.

Cho phép dùng camera điện thoại mặc định để mở URL, không bắt buộc tự viết bộ quét. QR trỏ tới URL HTTPS của frontend đã triển khai; localhost trên laptop không dùng được từ điện thoại.

Timeline nghiệp vụ kết hợp BatchCreated, TransitRecorded, IncidentReported, BatchRecalled; ownership history vẫn trình bày riêng từ Transfer. Mỗi mốc và mỗi dòng lịch sử hiển thị txHash rút gọn kèm link tới Sepolia Etherscan (https\://sepolia.etherscan.io/tx/{txHash}); địa chỉ contract và ví cũng có link. Tránh hiển thị một lần bàn giao thành hai lần đổi chủ vì cả TransferAccepted và Transfer cùng tồn tại.

 

# **22\. GĐ06: Python/Web3.py và IoT**

## **22.1 Script simulate.py bắt buộc**

·      1\. Đọc .env, ABI và manifest triển khai; kiểm kết nối RPC, chainId và contract có bytecode. Kiểm ví từ private key đúng Logistics dự kiến.  
·      2\. Nạp readings.csv: readingId, tokenId, tempCenti, observedAt, location. Dùng số nguyên: 1250 biểu thị 12,50°C.  
·      3\. Kiểm ví đang giữ lô InTransit; build\_transaction cho recordTransit, lấy nonce pending, ước lượng gas và thiết lập phí phù hợp mạng.  
·      4\. Ký bằng account.sign\_transaction, gửi send\_raw\_transaction, chờ receipt. Gửi tuần tự để tránh xung đột nonce; ghi txHash/status/gasUsed ra CSV.  
·      5\. Với timeout, truy vấn lại txHash trước khi thử tiếp; không tự gửi cùng readingId vô hạn. Contract chặn readingId trùng.  
·      6\. Cung cấp chế độ \--dry-run kiểm dữ liệu không phát giao dịch, \--count để giới hạn số readings và \--interval để giãn thời gian.

## **22.2 Bộ dữ liệu demo**

Chọn ngưỡng cấu hình minh họa 8–15°C, không coi đây là tiêu chuẩn bảo quản dừa đã được kiểm chứng. Tạo 5 readings: 10, 12, 18, 13, 11°C. Mẫu 18°C hiện cảnh báo; không tự kết luận nhiễm khuẩn.

Local chạy lặp nhiều mẫu để debug; Sepolia gửi ít mẫu đủ minh chứng. Dùng Web3.py 7.13.0 theo API giao dịch \[11\]. Đạt mốc khi event do ví Logistics tạo xuất hiện trên DApp cùng txHash và đúng đơn vị.

 

# **23\. GĐ06: báo sự cố và truy ngược**

## **23.1 Bắt đầu tại siêu thị**

·      1\. Retailer mở COCONUT-001 đã Delivered hoặc Sold, chọn Báo cáo sự cố; nhập mô tả phát hiện dấu hiệu nhiễm khuẩn giả lập.  
·      2\. Tạo báo cáo JSON/PDF mẫu trên IPFS; ghi reportIncident với CID/hash. Contract xác nhận Retailer đang giữ lô và phát IncidentReported.  
·      3\. Trang sự cố truy ngược tokenId → các Transfer/TransitRecorded → Farmer → farmId và harvestGroupId.  
·      4\. Tìm các lô cùng farmId \+ harvestGroupId; phân biệt cùng trang trại khác đợt và trang trại khác. Hiển thị lý do lô được đưa vào diện xem xét.  
·      5\. Admin xem bằng chứng, chọn từng lô và ghi recallBatch với incidentId/lý do. Không tự thu hồi tất cả lô của farm chỉ vì cùng farmId.  
·      6\. QR của các lô đã thu hồi hiện cảnh báo, kể cả Sold; giao dịch vận chuyển/bàn giao/bán mới bị chặn.

## **23.2 Kết quả và phạm vi kết luận**

Lô liên quan là danh sách theo quy tắc truy xuất, chưa phải kết luận đã nhiễm khuẩn. Nhiệt độ bất thường chỉ là dấu hiệu hỗ trợ điều tra. Báo cáo sự cố không tự động biến thành xác nhận kiểm nghiệm.

Đạt mốc: COCONUT-001 dẫn về FARM-A/HG-A01 và tìm COCONUT-002; COCONUT-003 khác nhóm và COCONUT-004 khác farm không tự bị thu hồi. Có chức năng F10, tx báo sự cố và tx quyết định riêng.

 

# **24\. GĐ07: triển khai Sepolia**

## **24.1 Các bước triển khai**

·      1\. Chạy lại contract tests, API tests và build frontend. Sao lưu dữ liệu demo (pg\_dump nếu có), khóa phiên bản và commit chuẩn bị triển khai.  
·      2\. Tạo endpoint RPC Sepolia; cấp test ETH cho năm ví demo; kiểm chainId 11155111 và số dư. Không dùng ETH mainnet.  
·      3\. Cấu hình network trong Hardhat 3, dùng biến môi trường cho URL/khóa. Chạy Ignition module với \--network sepolia; ghi deploy receipt.  
·      4\. Lưu chainId, address, deployBlock, txHash, compiler, ABI hash và git commit trong docs/deployments/sepolia.json.  
·      5\. Cấp roles/farmId; export cùng ABI/address sang frontend, backend, iot. Xác nhận ba phía đang trỏ cùng deployment.  
·      6\. Upload hồ sơ, tạo bốn lô; chạy luồng qua ba chủ thể; gửi 5 readings; thực hiện nhận có verify, báo sự cố và thu hồi.  
·      7\. Nếu triển khai lại contract, cập nhật manifest, biến môi trường của frontend/backend/iot và QR; không trộn events của contract cũ với contract mới.

 

## **24.2 Triển khai frontend và backend**

Đề yêu cầu trang người tiêu dùng là trang web công khai, nên frontend và backend được triển khai lên môi trường truy cập được qua HTTPS; blockchain vẫn là Sepolia thật.

·      1\. Frontend: npm run build, đặt VITE\_\* lúc build, đưa thư mục build lên hosting tĩnh có HTTPS.  
·      2\. Backend: đóng gói bằng Dockerfile, chạy uvicorn, triển khai lên nền tảng PaaS có HTTPS; dùng PostgreSQL do nền tảng cấp (một DB cho cả bản triển khai). Đặt secret trong cấu hình nền tảng; chạy alembic upgrade head khi phát hành.  
·      3\. Đặt ALLOWED\_ORIGIN đúng origin frontend; kiểm /health, đăng nhập ví, upload và tải tài liệu riêng trên URL thật (ca I11).  
·      4\. Admin cấp vai trò và farmId trước; sau đó chạy scripts/seed\_demo.py để chuẩn bị bốn lô COCONUT-001..004 và hồ sơ mẫu bằng ví đúng vai trò. Địa chỉ contract phải giống nhau ở frontend, backend và iot.  
·      5\. Trước buổi bảo vệ: gọi /health để đánh thức dịch vụ (gói miễn phí có thể ngủ khi không dùng), chạy pg\_dump, kiểm hạn mức RPC và Pinata.

## **24.3 Quy tắc môi trường**

Demo chính chạy trên bản đã triển khai. Máy cá nhân dùng để phát triển/test với PostgreSQL cục bộ và MASTER\_KEY riêng; DB cục bộ không chia sẻ giữa các máy. Docker Compose chỉ phục vụ việc này, không dùng để triển khai.

Tài khoản là địa chỉ ví và vai trò nằm trên chain, nên mọi môi trường dùng cùng contract thấy cùng vai trò. Chỉ nonce, phiên và tài liệu riêng khác nhau giữa bản triển khai và bản cục bộ; người dùng được cấp quyền vẫn đọc được tài liệu từ máy khác khi đăng nhập đúng ví và gọi cùng backend đã triển khai. Backend cục bộ dùng DB/MASTER\_KEY riêng không tự đọc được tài liệu của bản triển khai.

Chuẩn bị video dự phòng khi RPC/faucet/gateway/hosting không ổn. Video phải ghi rõ mạng và thời điểm, không thay số liệu local thành số liệu testnet.

 

# **25\. Dữ liệu và kịch bản demo**

Bảng 12\. Bộ lô kiểm chứng truy ngược

| Lô | Thuộc tính và vai trò trong demo |
| :---- | :---- |
| COCONUT-001 | FARM-A / HG-A01; lô tại Retailer phát hiện sự cố; có readings bất thường. Khối lượng 1.000 kg; một NFT. |
| COCONUT-002 | FARM-A / HG-A01; lô liên quan, thử thu hồi kể cả khi Sold. Khối lượng 1.000 kg; một NFT. |
| COCONUT-003 | FARM-A / HG-A02; đối chứng khác nhóm thu hoạch. Khối lượng 1.000 kg; một NFT. |
| COCONUT-004 | FARM-B / HG-B01; đối chứng khác trang trại. Khối lượng 1.000 kg; một NFT. |

## **25.1 Demo chính 8–12 phút**

1\. Mở Retailer/COCONUT-001, mô tả tình huống và báo sự cố. 2\. Truy ngược về FARM-A, xem ownership history và nhiệt độ từ Python. 3\. Tìm COCONUT-002, Admin thu hồi hai lô với lý do. 4\. Mở QR cho thấy cảnh báo; hai lô đối chứng vẫn bình thường.

5\. Dùng một lô mới riêng để trình diễn trực tiếp createBatch/mint, tokenURI, request/accept và kiểm hash khi Retailer nhận. 6\. Tải tài liệu riêng bằng ví được phép; kết thúc bằng tx hash, CID và các minh chứng rubric.

Chuẩn bị trước dữ liệu cho phần điều tra, nhưng phân biệt rõ giao dịch đã tạo trước với giao dịch đang thực hiện. Ca cố ý hash sai/quyền sai nằm trong video hoặc phiên kiểm thử riêng, không trộn vào luồng demo chính.

 

## **25.2 Diễn tập trước khi quay video**

Cả nhóm diễn tập trọn kịch bản mục 25.1 ít nhất một lần trên bản đã triển khai trước khi quay. Kiểm số dư ví, đúng chain/contract, quyền từng ví, truy xuất IPFS, /health và các tab cần dùng; ghi lại mỗi tương tác và kết quả.

Theo RB2, luồng demo chính có tối đa 1 lỗi giao dịch; mục tiêu nội bộ là 0 lỗi. Ghi riêng các lần từ chối ký, revert, timeout hoặc receipt thất bại cùng nguyên nhân; kiểm tra lại receipt khi timeout để tránh tính nhầm giao dịch thành công. Nếu vượt ngưỡng, sửa lỗi và diễn tập lại trước khi quay.

Các ca cố ý hash sai hoặc sai quyền được trình bày ở đoạn kiểm thử riêng, ghi nhãn rõ; không dùng cách tách đoạn để che lỗi ngoài dự kiến. Minh chứng lưu tại docs/evidence/demo/rehearsal.md gồm ngày, commit, URL, chain/address, số tương tác, số lỗi, nguyên nhân và kết quả lần diễn tập lại. Tham chiếu dòng 173 của bảng plan.xlsx.

 

# **26\. Kiểm thử contract bắt buộc**

Bảng 13\. Ca kiểm thử C01–C14

| Mã | Thao tác và kết quả mong đợi |
| :---- | :---- |
| C01 | Farmer tạo lô 1.000 kg hợp lệ → BatchCreated, NFT và URI đúng. |
| C02 | Sai role/farmId hoặc trùng mã → revert, không mint. |
| C03 | quantityKg khác 1000 (thử 0, 999, 1001), ngày sai hoặc expiry bằng now → revert; không mint và không tạo lô. |
| C04 | Request hợp lệ → pending; owner chưa đổi. |
| C05 | Sai người/tuyến hoặc đã có pending → revert. |
| C06 | Accept đúng 3 hash → đổi chủ/trạng thái; Transfer đúng. |
| C07 | Sai một trong 3 hash → revert; trạng thái/owner giữ nguyên. |
| C08 | Accept request cũ, đã cancel hoặc đã accept → revert. |
| C09 | Reject/cancel đúng quyền đóng request; sai ví bị chặn. |
| C10 | Role bị thu hồi giữa request và accept → không bàn giao. |
| C11 | transferFrom/safeTransferFrom/approval né luồng → bị chặn. |
| C12 | Callback bên nhận thử gọi lại → không tạo chuyển trái phép. |
| C13 | Logistics đúng chủ ghi reading; sai chủ/trùng readingId → chặn. |
| C14 | markSold chỉ từ Delivered và đúng Retailer; gọi lại → chặn. |

Test local dùng fixture/snapshot, tăng thời gian chain để thử expiry; không chờ ngày thật. Assertion kiểm cả trạng thái, owner và event. Test pass không thay thế việc xem xét code kiểm quyền.

 

# **27\. Kiểm thử tích hợp và bảo mật**

Bảng 14\. Ca kiểm thử C15–C18 và I01–I11

| Mã | Kết quả mong đợi |
| :---- | :---- |
| C15 | Expired/recalled/Sold chặn chuyển và ghi vận chuyển. |
| C16 | Retailer báo sự cố sau Sold được; người lạ bị chặn. |
| C17 | Admin recall lô Sold được; lý do/event còn truy xuất. |
| C18 | tokenURI đúng; dựng Transfer history khớp ownerOf. |
| I01 | PDF/ảnh/JSON upload–retrieve đúng byte/hash. Consumer không kết nối ví mở được chứng chỉ gốc và ảnh lô từ liên kết IPFS trên trang trace. |
| I02 | Sửa một byte → frontend báo lỗi; không cho accept. |
| I03 | Nonce replay/hết hạn/sai domain, ký sai ví → từ chối. |
| I04 | Hai lần verify đồng thời: chỉ một lần consume nonce (UPDATE nguyên tử trong PostgreSQL). |
| I05 | ACL theo file; Admin không grant → 403; revoke có hiệu lực. |
| I06 | Ciphertext/tag sai → giải mã thất bại; không trả plaintext. |
| I07 | Python gửi 5 readings → DApp thấy 5 events, một cảnh báo. |
| I08 | Truy ngược trả đúng 2 lô, không thu hồi lô đối chứng. |
| I09 | Đổi ví/sai mạng/từ chối ký/timeout → UI không báo thành công giả. |
| I10 | Tải lại trang trace trên trình duyệt sạch, dựng lịch sử trực tiếp từ chain → đúng; QR hiện recall sau Sold; link Etherscan mở đúng tx. |
| I11 | Bản triển khai: HTTPS, CORS đúng origin, đăng nhập ví → upload → tải tài liệu riêng; trang trace mở được từ điện thoại. |

Bổ sung trong I05: bind draft đúng receipt thành công; receipt sai contract/uploader/hash hoặc bind chéo lô bị chặn; gọi bind lặp không tạo bản ghi trùng. Trong I11 kiểm cùng ví hợp lệ đọc file từ hai thiết bị qua cùng backend triển khai.

 

Test API bằng pytest (FastAPI TestClient/httpx) trên PostgreSQL thử nghiệm; test ví và DApp theo checklist. Ghi actual result, pass/fail, ngày, commit, chain/address và evidence path. Lỗi phải được sửa rồi chạy lại ca liên quan; không báo tỷ lệ pass trước khi chạy.

Rubric yêu cầu contract được triển khai và kiểm thử thành công trên testnet. Vì vậy một tập con ca contract được chạy lại trên Sepolia và ghi kết quả thật; ca revert chạy bằng eth\_call/estimateGas để thấy lỗi mà không tốn giao dịch, hoặc gửi giao dịch với gasLimit cố định nếu cần receipt thất bại làm minh chứng. Các ca còn lại chạy local.

Bảng 15\. Tập ca chạy trên Sepolia

| Mã | Cách chạy trên Sepolia và dữ liệu ghi lại (kết quả thật điền sau khi chạy) |
| :---- | :---- |
| C01 | createBatch hợp lệ: txHash, tokenId, tokenURI. |
| C02 | Ví không phải Farmer gọi createBatch: lỗi revert từ eth\_call. |
| C06 | Accept đúng 3 hash: txHash, ownerOf mới, Transfer. |
| C07 | Accept với hash sai: lỗi HashMismatch, owner không đổi. |
| C11 | transferFrom trực tiếp: bị chặn. |
| C13 | recordTransit của Logistics: txHash và event. |
| C14 | markSold từ Delivered; gọi lại bị chặn. |
| C17 | Admin recall lô Sold: txHash và QR hiện cảnh báo. |
| C18 | tokenURI đúng; lịch sử Transfer khớp ownerOf. |

 

# **28\. Đo lường và quản lý bằng chứng**

## **28.1 Số liệu phải đo thật**

·      Gas: lấy receipt.gasUsed của createBatch, request/accept, recordTransit, reportIncident, recallBatch. Chi phí phí mạng \= gasUsed × effective gas price; ghi đơn vị và mạng.  
·      Thời gian nhận receipt: đo từ gửi giao dịch đến receipt; phân biệt thời gian người dùng ký ví.  
·      Thời gian truy vết: đo từ bắt đầu truy vấn đến dựng danh sách lô/timeline; ghi số events, khoảng block, RPC, số lần đo và trạng thái phiên trình duyệt (mở mới hoặc đã tải dữ liệu vào bộ nhớ). Không có cache event trong PostgreSQL.  
·      Độ sẵn sàng hồ sơ: ghi 3 CID, thời gian tải, kết quả hash. Không suy rộng vài lần thử thành cam kết uptime.

## **28.2 Cấu trúc evidence**

docs/evidence/contracts: test log và ảnh giao dịch. ipfs: CID manifest và ảnh retrieve. security: ACL/replay/tamper. iot: readings.csv và tx log. trace: kết quả lô liên quan. demo: script và video. report: bảng ánh xạ tiêu chí.

Trong mỗi bảng kết quả ghi giá trị thực, thời điểm và môi trường. Có thể để “chưa đo” trong tiến độ, nhưng trước nộp phải bổ sung hoặc công khai phần chưa hoàn thành.

## **28.3 Điều kiện chốt bản release**

Luồng chính chạy hết trên bản đã triển khai; không còn lỗi nghiêm trọng về quyền/hash/owner; tất cả ca bắt buộc có kết quả; ABI/address thống nhất giữa frontend, backend, iot; file riêng không lộ key. Điều kiện nội bộ của nhóm (không phải yêu cầu của đề hay rubric): README từ checkout mới đủ hướng dẫn chạy. Gắn tag release cho commit dùng bảo vệ.

 

# **29\. GĐ08: báo cáo và slide**

## **29.1 Cấu trúc báo cáo**

·      Chương 1: bài toán, phạm vi, vai trò, yêu cầu và Critical Tracking Events.  
·      Chương 2: blockchain, ERC-721, IPFS, AES-GCM; trích nguồn đúng nội dung.  
·      Chương 3: kiến trúc, state diagram, schema, API, phân chia on/off-chain và threat model ngắn.  
·      Chương 4: hiện thực theo stack; ánh xạ ba hàm đề; verify hash; Python IoT; ACL; NFT và Transfer history; triển khai web.  
·      Chương 5: kiểm thử, số liệu đo, kịch bản sự cố tại siêu thị và đối chiếu rubric.  
·      Chương 6: giới hạn, phần mở rộng, kết luận; phụ lục hướng dẫn chạy và địa chỉ triển khai.

## **29.2 Slide giải thích ràng buộc**

Dành ít nhất một slide “Ràng buộc được cưỡng chế như thế nào”: onlyRole \+ ownerOf; check lifecycle/expiry/recall; compare hash; chặn transfer trực tiếp; ví dụ test revert. Dẫn tên hàm/đoạn code cụ thể của bản release.

Slide NFT: một lô/một token, tokenURI ipfs://CID, mint và transfer, lịch sử bằng Transfer. Slide bảo mật: AES-GCM \+ ACL, chống replay và giới hạn backend giữ khóa.

Word dùng chữ 15 pt; slide từ 20 pt; hình/bảng có số và caption, thuật ngữ có bảng viết tắt. Video có phụ đề, cho thấy ví/chain/address, không quay secret. Giữ bảng truy vết yêu cầu → code → test → minh chứng.

 

# **30\. Việc làm ngay và kiểm soát phạm vi**

## **30.1 Ba buổi triển khai đầu tiên**

·      Buổi 1: tạo repo và cấu trúc; kiểm Node/Python; init Hardhat/frontend; tạo venv backend và PostgreSQL cục bộ; chạy smoke test; commit khởi tạo và lockfile.  
·      Buổi 2: hoàn thành requirements.md, state diagram, schema contract, API và 29 ca test; tạo ví demo và bộ hồ sơ mẫu; review thống nhất.  
·      Buổi 3: viết roles/farm mapping, createBatch và test C01–C03; xuất ABI; chạy mint local. Chưa làm biểu đồ hoặc giao diện đẹp.

## **30.2 Khi chậm tiến độ**

Giữ ưu tiên: contract đúng → hồ sơ/verify → UI toàn luồng → Python \+ truy ngược → testnet → báo cáo. Cắt tùy biến UI, dashboard nâng cao và quản trị khôi phục trước. Không cắt IoT/truy ngược cơ bản rồi gọi đó là phần ngoài đề.

Ví bị thu hồi khi giữ lô: chặn thao tác mới, giữ lịch sử; quy trình thay ví là giới hạn đã công bố. Không tự động chuyển NFT bằng quyền Admin để cứu demo mà thiếu nghiệp vụ.

## **30.3 Mẫu cập nhật hàng ngày**

Giai đoạn hiện tại: … \| Issue đang làm: … \| Đã có đầu ra: … \| Test/minh chứng: … \| Vướng mắc: … \| Bước tiếp theo: …

Kế hoạch hoàn thành khi có sản phẩm chạy được và hồ sơ chứng minh; số lượng chức năng lớn không tự đảm bảo điểm cao. Mọi thay đổi thiết kế sau đây phải cập nhật cả contract/API/test và tài liệu tương ứng.

 

# **31\. Thuật ngữ và nguồn tham khảo**

Bảng 16\. Thuật ngữ sử dụng

| Thuật ngữ | Ý nghĩa trong đồ án |
| :---- | :---- |
| DApp / RPC | Ứng dụng tương tác blockchain / giao diện kết nối node. |
| ABI / NFT | Giao diện gọi contract / token duy nhất đại diện lô. |
| IPFS / CID | Lưu trữ theo nội dung / mã định danh nội dung. |
| CTE / RBAC | Mốc truy vết quan trọng / phân quyền theo vai trò. |
| ACL / AAD | Quyền trên từng tài liệu / dữ liệu kèm được xác thực. |
| Receipt / Event | Kết quả thực thi giao dịch / log có thể truy vấn. |
| AES-GCM | Mã hóa đối xứng có xác thực; phải bảo vệ key và IV. |
| API / PaaS | Giao diện lập trình ứng dụng / nền tảng chạy ứng dụng trên đám mây. |
| CORS / JWT | Quy tắc origin được gọi API / token ký số (PINATA\_JWT). |

\[1\] Giảng viên môn Công nghệ Blockchain. “Bài tập 07: Xây dựng hệ thống truy xuất nguồn gốc thực phẩm”. Đề tài do sinh viên cung cấp.

\[2\] Giảng viên môn Công nghệ Blockchain. Rubric chấm đồ án (Rubik.xlsx), năm tiêu chí. Tệp Excel do sinh viên cung cấp.

\[3\] Ethereum Improvement Proposals. ERC-721: Non-Fungible Token Standard. https\://eips.ethereum.org/EIPS/eip-721

\[4\] OpenZeppelin. Contracts 5.x: ERC-721, AccessControl và API. https\://docs.openzeppelin.com/contracts/5.x/

\[5\] IPFS Docs. Content Identifiers (CIDs). https\://docs.ipfs.tech/concepts/content-addressing/

\[6\] Hardhat. Getting started with Hardhat 3\. https\://hardhat.org/docs/getting-started

\[7\] Hardhat. Mocha \+ ethers toolbox. https\://hardhat.org/docs/plugins/hardhat-toolbox-mocha-ethers

 

\[8\] Vite. Vite 7 announcement and runtime requirements. https\://vite.dev/blog/announcing-vite7

\[9\] Pinata. The V3 Pinata API Is Here. https\://pinata.cloud/blog/the-v3-pinata-api-is-here/

\[10\] NIST. SP 800-38D, Recommendation for Block Cipher Modes of Operation: GCM and GMAC. 2007\. https\://csrc.nist.gov/pubs/sp/800/38/d/final

\[11\] Web3.py. Transactions, version 7.13.0. https\://web3py.readthedocs.io/en/v7.13.0/transactions.html

Nguồn trực tuyến đối chiếu ngày 15/10/2026. Khi khóa bản release, bổ sung phiên bản package thực tế và chỉ trích nội dung đã dùng.

 

# **32\. Checklist nộp**

## **Checklist bàn giao**

·      Source \+ lockfiles \+ .env.example \+ README; docker-compose.yml nếu có; không kèm secret.  
·      Manifest Sepolia \+ ABI \+ CID/hash \+ tx minh chứng.  
·      Bảng test đã chạy (gồm Bảng 15 trên Sepolia); số liệu thật; báo cáo Word/PDF theo yêu cầu lớp.  
·      Slide có giải thích ràng buộc; video có phụ đề; kịch bản demo, URL bản triển khai và phương án khi mạng/hosting lỗi.

[image1]: <data:image/png;base64,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>