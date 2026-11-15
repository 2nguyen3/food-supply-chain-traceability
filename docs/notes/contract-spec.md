# Đặc tả contract `FoodTraceability`

Nguồn: KeHoach mục 5, 7–11, 16. Sơ đồ: `docs/diagrams/02-nghiep-vu.drawio` (Vòng đời lô hàng), `03-sequence.drawio` (Bàn giao, Tạo lô, Sự cố và thu hồi, IoT), `04-data-model.drawio` (Cấu trúc contract).

**Trạng thái:** nghiệp vụ, trạng thái, hàm, event, ràng buộc là theo KeHoach. Phần KeHoach không nêu (kiểu dữ liệu Solidity, tên hàm gán Farmer, chữ ký event đầy đủ, **danh sách custom error**, thứ tự kiểm tra) là **đề xuất 21/10/2026, chờ review nhóm**, đánh dấu ⟨đề xuất⟩. Đã cài và test xanh (51 ca Mocha): tạo lô, hàm đọc, bàn giao hai bước (P03-02 đến P03-07). Đã cài thêm `recordTransit`, `markSold`, sự cố/thu hồi, chặn đường vòng (P03-08 đến P03-11, 90 ca Mocha). Cần optimizer (runs 200) vì không có thì contract vượt 24 KB.

## Kế thừa
NFT: tên `Food Traceability Batch`, ký hiệu `FTB`.
`ERC721URIStorage`, `AccessControl`, `ReentrancyGuard` (OZ 5.4.0). Resolve `supportsInterface` theo các base.

## Roles
`ADMIN_ROLE`, `FARMER_ROLE`, `LOGISTICS_ROLE`, `RETAILER_ROLE`. Constructor cấp Admin cho ví deploy.
Quyết định (21/10/2026): `bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;` để `DEFAULT_ADMIN_ROLE` mặc định quản lý mọi role khác, không cần `_setRoleAdmin`.

## Trạng thái
- `lifecycle`: `Created → InTransit → Delivered → Sold`.
  - Farmer→Logistics accept → InTransit. Logistics→Retailer accept → Delivered.
  - Request **không** đổi owner hay trạng thái.
- `expired`: suy ra từ `block.timestamp >= expiryDate`, không lưu, không cần giao dịch. UI hiện cả nhãn hết hạn và lifecycle gốc.
- `recalled`: cờ độc lập, không ghi đè lịch sử. Sold vẫn thu hồi được.
- Sau Sold, NFT ở lại Retailer (đơn vị chịu trách nhiệm cuối).

**Tuyến bàn giao** suy ra từ `lifecycle` hiện tại (không cần tham số):

| lifecycle hiện tại | Chủ phải giữ vai trò | Người nhận phải giữ vai trò | Sau accept |
|---|---|---|---|
| Created | FARMER | LOGISTICS | InTransit |
| InTransit | LOGISTICS | RETAILER | Delivered |
| Delivered, Sold | không còn tuyến nào | | request bị `InvalidRoute` (Sold bị `BatchLocked` trước) |

## Kiểu dữ liệu ⟨đề xuất⟩
```solidity
enum Lifecycle { Created, InTransit, Delivered, Sold }
enum LockReason { Sold, Expired, Recalled }

struct BatchInfo {            // đầu vào của createBatch
    string batchCode; string harvestGroupId; string farmLocation;
    uint256 quantityKg; uint64 harvestDate; uint64 expiryDate;
}
struct Batch {
    uint256 tokenId;
    string  batchCode;        // ví dụ "COCONUT-001"
    string  farmId;           // ví dụ "FARM-A"
    string  farmLocation;     // công khai tại thời điểm tạo lô
    string  harvestGroupId;   // ví dụ "HG-A01"
    uint256 quantityKg;       // luôn 1000
    uint64  harvestDate;      // Unix seconds UTC
    uint64  expiryDate;
    Lifecycle lifecycle;
    bool    recalled;
    bytes32 metadataHash;     // SHA-256 byte file, không phải CID
    bytes32 certificateHash;
    bytes32 imageHash;
}
struct PendingTransfer { uint256 requestId; uint256 tokenId; address from; address to; bool active; }
struct Incident { uint256 incidentId; uint256 tokenId; address reporter; string reportCID; bytes32 reportHash; uint64 timestamp; }
```
- `tokenId`, `requestId`, `incidentId` là bộ đếm toàn cục **bắt đầu từ 1** (0 = không tồn tại). `requestId` tăng mỗi lần tạo yêu cầu để chặn chấp nhận yêu cầu cũ.
- Mỗi lô tối đa một yêu cầu đang chờ.
- Incident chỉ được **thêm**, không sửa hay xóa.
- `tempCenti` dùng `int32` (cho phép nhiệt độ âm; 1250 = 12,50°C). `readingId` là `uint256`.

**Lưu trữ:**
```solidity
mapping(uint256 => Batch) batches;
mapping(bytes32 => uint256) tokenIdByCode;            // key = keccak256(bytes(batchCode))
mapping(address => string)  farmIdOf;                 // Admin gán
mapping(uint256 => PendingTransfer) pending;          // theo tokenId
mapping(uint256 => mapping(uint256 => bool)) readingUsed; // tokenId → readingId
mapping(uint256 => uint64)  lastObservedAt;           // tokenId → quan sát gần nhất (BR06: không lùi)
mapping(uint256 => Incident) incidents;
uint256 nextTokenId = 1; uint256 nextRequestId = 1; uint256 nextIncidentId = 1;
```

## Hàm ghi
| Hàm | Điều kiện | Kết quả |
|---|---|---|
| `assignFarmer(address farmer, string farmId)` ⟨đề xuất tên⟩ | Admin; `farmer != 0`; `farmId` không rỗng | cấp `FARMER_ROLE` + gán `farmIdOf`; `FarmerAssigned` |
| cấp / thu hồi vai trò khác | Admin (`grantRole` / `revokeRole` của OZ) | event `RoleGranted` / `RoleRevoked` |
| `createBatch(info, metadataCID, metadataHash, certificateHash, imageHash)` | FARMER_ROLE, có farmId, mã duy nhất, quantityKg == 1000, harvestDate ≤ now < expiryDate | Mint cho Farmer, set URI `ipfs://metadataCID`; `BatchCreated` |
| `requestTransfer(tokenId, to)` | Chủ hiện tại; đúng tuyến (bảng trên) và `to` có vai trò tương ứng; chưa có pending; không Sold/expired/recalled | Tạo requestId; `TransferRequested` |
| `acceptTransfer(tokenId, requestId, hashes[3])` | Đúng người nhận; **cả người gửi và người nhận** còn vai trò đúng (BR04, C10); requestId active; người gửi vẫn là chủ; không Sold/expired/recalled; 3 hash khớp | Đóng pending → cập nhật lifecycle → `_safeTransfer`; `TransferAccepted` + `Transfer` |
| `rejectTransfer(tokenId, requestId)` | Đúng người nhận | Đóng pending; `TransferRejected` |
| `cancelTransfer(tokenId, requestId)` | Đúng người gửi (cả khi lô đã recall) | Đóng pending; `TransferCancelled` |
| `recordTransit(tokenId, readingId, tempCenti, observedAt, location)` | Logistics đang giữ; InTransit; không expired/recalled; readingId mới; observedAt ≤ now và ≥ `lastObservedAt` | `TransitRecorded` |
| `markSold(tokenId)` | Retailer đang giữ; Delivered; chưa hết hạn/thu hồi | `lifecycle = Sold`; `BatchSold` |
| `reportIncident(tokenId, reportCID, reportHash)` | Retailer đang giữ; Delivered hoặc Sold. **Không** bị chặn bởi expired/recalled (BR07) | thêm Incident; `IncidentReported` |
| `recallBatch(tokenId, incidentId, reasonCID, reasonHash)` | Admin; lô tồn tại; chưa thu hồi; incidentId đã tồn tại (có thể thuộc lô khác); reason không rỗng. Được phép khi Sold hoặc expired | `recalled = true`; `BatchRecalled` |

Bàn giao lần đầu (Farmer → Logistics) cũng đối chiếu **đủ 3 hash**, cùng quy trình với Retailer (KeHoach 11.2).

## Hàm đọc
`getBatch(tokenId)` (revert `BatchNotFound` nếu không tồn tại; `getPendingTransfer`, `isExpired` cũng vậy), `getTokenIdByCode(batchCode)` (trả 0 nếu chưa có), `getPendingTransfer(tokenId)`, `isExpired(tokenId)`, `farmIdOf(address)`, `getIncident(incidentId)`, `ownerOf`, `tokenURI`, `hasRole`. Không lặp toàn bộ lô on-chain; tìm lô liên quan (cùng farmId/nhóm thu hồi) làm ngoài chuỗi rồi thu hồi từng lô.

## Event (CTE) ⟨đề xuất chữ ký⟩
Trường theo KeHoach Bảng 7; kiểu và việc `indexed` là đề xuất.
```solidity
event FarmerAssigned(address indexed farmer, string farmId);
event BatchCreated(uint256 indexed tokenId, address indexed farmer, string farmId, string harvestGroupId,
                   string batchCode, uint64 harvestDate, string metadataCID, bytes32 metadataHash);
event TransferRequested(uint256 indexed tokenId, address indexed from, address indexed to, uint256 requestId);
event TransferAccepted(uint256 indexed tokenId, address indexed from, address indexed to, uint256 requestId,
                       bytes32 metadataHash, bytes32 certificateHash, bytes32 imageHash);
event TransferRejected(uint256 indexed tokenId, uint256 requestId, address indexed by);
event TransferCancelled(uint256 indexed tokenId, uint256 requestId, address indexed by);
event TransitRecorded(uint256 indexed tokenId, uint256 indexed readingId, int32 tempCenti, uint64 observedAt, string location);
event BatchSold(uint256 indexed tokenId, address indexed retailer, uint64 soldAt);
event IncidentReported(uint256 indexed incidentId, uint256 indexed tokenId, address indexed retailer, string reportCID, bytes32 reportHash);
event BatchRecalled(uint256 indexed tokenId, uint256 indexed incidentId, address indexed admin, string reasonCID, bytes32 reasonHash);
```
Cộng `Transfer` (ERC-721; mint từ zero address là mốc nguồn gốc) và `RoleGranted`/`RoleRevoked`. Người ký `recordTransit` và thời gian block lấy từ giao dịch; `observedAt` do simulator cung cấp **không** phải thời gian đã được blockchain xác thực.

## Chặn đường vòng
- Override `transferFrom` và `safeTransferFrom` (4 tham số) để revert; bản 3 tham số của OZ 5.4.0 gọi bản 4 nên cũng bị chặn.
- Vô hiệu `approve`, `setApprovalForAll`. Không có hàm chuyển hộ của Admin.
- Chỉ `acceptTransfer` gọi `_safeTransfer` sau khi kiểm nghiệp vụ. Giữ `_update` của OZ.
- `nonReentrant` cho hàm ghi; đóng pending và cập nhật trạng thái **trước** callback `onERC721Received`.

## Thứ tự kiểm tra ⟨đề xuất⟩
Ngoại lệ đã cài ở `acceptTransfer`/`rejectTransfer`/`cancelTransfer`: sau `BatchNotFound` là `NoActiveRequest` → `StaleRequest` → quyền (`NotRecipient`/`NotSender`), vì chưa có yêu cầu thì chưa biết ai là người nhận. Trong `acceptTransfer`, sau quyền là `BatchLocked` → `RoleNoLongerValid` (người gửi rồi người nhận) → `HashMismatch`. `reject`/`cancel` không bị khóa lô.

Để test xác định được lỗi nào bật ra khi nhiều điều kiện cùng sai, mọi hàm kiểm theo thứ tự:
1. Lô tồn tại (`BatchNotFound`)
2. Quyền: vai trò và chủ sở hữu / người nhận (`AccessControlUnauthorizedAccount`, `NotTokenOwner`, `NotRecipient`, `NotSender`)
3. Khóa lô: Sold / expired / recalled (`BatchLocked`)
4. Trạng thái và tuyến (`InvalidRoute`, `PendingExists`, `NoActiveRequest`, `StaleRequest`)
5. Đầu vào (số lượng, ngày, hash, readingId, observedAt, chuỗi rỗng)
6. Đối chiếu hash (`HashMismatch`), làm **cuối cùng** trong `acceptTransfer`

## Custom errors ⟨đề xuất, chờ review⟩
Dùng `error` riêng thay vì `require` chuỗi (rẻ gas hơn và DApp phân biệt được nguyên nhân). Lỗi có sẵn của OZ giữ nguyên: `AccessControlUnauthorizedAccount(account, neededRole)` cho `onlyRole`, `ReentrancyGuardReentrantCall()`.

| Lỗi | Hàm | Quy tắc | Ca test |
|---|---|---|---|
| `AccessControlUnauthorizedAccount(address, bytes32)` | `createBatch`, `assignFarmer`, `recallBatch`, `grantRole`... | BR01, BR07 | C02, X05 |
| `ZeroAddress()` | `assignFarmer` | đầu vào Admin | X05 |
| `EmptyFarmId()` | `assignFarmer` | đầu vào Admin | X05 |
| `FarmNotAssigned(address farmer)` | `createBatch` | BR01 (farmId do Admin gán) | C02 |
| `EmptyBatchCode()` | `createBatch` | BR01 | C03 |
| `DuplicateBatchCode(string batchCode)` | `createBatch` | BR01 mã duy nhất | C02 |
| `InvalidQuantity(uint256 given)` | `createBatch` | BR02 quantityKg == 1000 | C03 |
| `InvalidDates(uint64 harvestDate, uint64 expiryDate)` | `createBatch` | BR02 harvestDate ≤ now < expiryDate | C03 |
| `EmptyMetadata()` | `createBatch` | metadataCID rỗng hoặc hash = 0 | C03 |
| `BatchNotFound(uint256 tokenId)` | mọi hàm theo tokenId | tồn tại | X07 |
| `NotTokenOwner(uint256 tokenId, address caller)` | `requestTransfer`, `recordTransit`, `markSold`, `reportIncident` | BR03/BR04/BR06 chỉ chủ hiện tại | C05, C13, C14, C16 |
| `NotRecipient(address caller, address expected)` | `acceptTransfer`, `rejectTransfer` | BR04 đúng người nhận | C09 |
| `NotSender(address caller, address expected)` | `cancelTransfer` | đúng người gửi | C09 |
| `RoleNoLongerValid(address account, bytes32 role)` | `acceptTransfer` | BR04 kiểm cả hai bên lúc accept | C10 |
| `BatchLocked(uint256 tokenId, LockReason reason)` | `requestTransfer`, `acceptTransfer`, `recordTransit`, `markSold` | BR05 | C15 |
| `InvalidRoute(address from, address to)` | `requestTransfer` | BR04 tuyến Farmer→Logistics→Retailer | C05, X03 |
| `PendingExists(uint256 tokenId, uint256 requestId)` | `requestTransfer` | tối đa một pending | C05 |
| `NoActiveRequest(uint256 tokenId)` | `acceptTransfer`, `rejectTransfer`, `cancelTransfer` | request phải active | C08, C09 |
| `StaleRequest(uint256 given, uint256 active)` | `acceptTransfer`, `rejectTransfer`, `cancelTransfer` | chặn requestId cũ | C08 |
| `HashMismatch(uint8 index)` | `acceptTransfer` | BR08; `index`: 0 metadata, 1 certificate, 2 image | C07 |
| `InvalidLifecycle(uint256 tokenId, Lifecycle current)` | `recordTransit`, `markSold`, `reportIncident` | chủ gọi sai lifecycle (cần InTransit / Delivered / Delivered hoặc Sold) | C13, C14, X06 |
| `ReadingUsed(uint256 tokenId, uint256 readingId)` | `recordTransit` | BR06 | C13 |
| `InvalidObservedAt(uint64 observedAt, uint64 last)` | `recordTransit` | BR06 không tương lai, không lùi | X04 |
| `EmptyReport()` | `reportIncident` | CID/hash rỗng | X06 |
| `UnknownIncident(uint256 incidentId)` | `recallBatch` | BR07 incidentId phải tồn tại | X01 |
| `AlreadyRecalled(uint256 tokenId)` | `recallBatch` | chưa thu hồi | C17, X02 |
| `EmptyReason()` | `recallBatch` | BR07 có lý do | X01 |
| `DirectTransferDisabled()` | `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll` | chặn né luồng | C11 |

## Đơn vị
Khối lượng kg; nhiệt độ centi-°C (`1250` = 12,50°C); thời gian Unix seconds UTC.

## Metadata JSON (IPFS)
`name, description, image (ipfs://), batchCode, farmId, harvestGroupId, certificateURI, certificateSHA256, imageSHA256, schemaVersion, cultivar, fertilizer, farmLocation, tempMin, tempMax, quantityKg`. Băm nguyên byte đã upload; không đặt metadataHash vào chính JSON (tham chiếu vòng). Không dùng CID thay SHA-256 của file.

## Điểm cần nhóm xác nhận khi review
Đã được bạn duyệt 21/10/2026 (xem `CLAUDE.local.md`, mục Quyết định đã duyệt): các mục 1–4. Mục 5 (event `TransferAccepted` mang cả ba hash) vẫn chờ review. Các dấu ⟨đề xuất⟩ ở nơi khác trong file chưa có trong decisions.md nên vẫn chờ review.
1. Tên hàm gán Farmer (`assignFarmer`) và việc nó cấp luôn `FARMER_ROLE`.
2. Kiểu dữ liệu: `uint64` cho ngày, `int32` cho `tempCenti`, `string` cho `batchCode`/`farmId`.
3. `reportIncident` **không** bị chặn bởi expired/recalled (suy từ BR07 và BR05).
4. Thứ tự kiểm tra ở trên và việc gộp lỗi khóa lô vào một `BatchLocked` có tham số `reason`.
5. Event `TransferAccepted` mang theo cả ba hash đã kiểm.
