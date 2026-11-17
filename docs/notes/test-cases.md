# Ca kiểm thử

Nguồn: KeHoach mục 26, 27, 28. Mã C01–C18 và I01–I11 giữ đúng KeHoach (đủ 29 ca). Mã **X01–X08** là ca bổ sung ⟨đề xuất⟩ để phủ các quy tắc BR mà C/I chưa kiểm hết (BR05, BR06, BR07, tuyến bàn giao, quyền Admin).

**Quy tắc ghi kết quả (KeHoach 27):** ghi kết quả thực, ngày, commit, chain/address và ghi chú. Lỗi phải sửa rồi chạy lại ca liên quan; không báo tỷ lệ pass trước khi chạy. Cột Kết quả để trống cho đến khi chạy thật.

**Phạm vi phụ trách:** contract (C, X) và backend/DB (I03, I04, I05, I06, phần backend của I01 và I11) là phần của bạn. I02, I07, I08, I09, I10 cần frontend hoặc IoT.

## Bảng theo dõi

| Mã | Nội dung ngắn | Nơi chạy | Kết quả | Ngày | Commit | Ghi chú |
|---|---|---|---|---|---|---|
| C01 | Tạo lô hợp lệ | Local + **Sepolia** | | | | |
| C02 | Sai role / farmId / trùng mã | Local + **Sepolia** | | | | |
| C03 | quantityKg ≠ 1000, ngày sai | Local | | | | |
| C04 | Request hợp lệ → pending, owner chưa đổi | Local | | | | |
| C05 | Request sai người / tuyến / đã có pending | Local | | | | |
| C06 | Accept đúng 3 hash | Local + **Sepolia** | | | | |
| C07 | Accept sai 1 hash | Local + **Sepolia** | | | | |
| C08 | Accept request cũ / đã đóng | Local | | | | |
| C09 | Reject / cancel đúng quyền, sai ví | Local | | | | |
| C10 | Role bị thu hồi giữa request và accept | Local | | | | |
| C11 | transferFrom / approve né luồng | Local + **Sepolia** | | | | |
| C12 | Callback bên nhận gọi lại (reentrancy) | Local | | | | |
| C13 | recordTransit đúng / sai chủ / trùng readingId | Local + **Sepolia** | | | | |
| C14 | markSold đúng / gọi lại | Local + **Sepolia** | | | | |
| C15 | Expired / recalled / Sold chặn thao tác | Local | | | | |
| C16 | reportIncident sau Sold; người lạ bị chặn | Local | | | | |
| C17 | Admin recall lô Sold | Local + **Sepolia** | | | | |
| C18 | tokenURI và Transfer history khớp ownerOf | Local + **Sepolia** | | | | |
| X01 | recall: incidentId không tồn tại / lý do rỗng | Local | | | | |
| X02 | recall không lan sang lô khác; recall lặp | Local | | | | |
| X03 | Tuyến sai: Farmer→Retailer, người nhận không có vai trò | Local | | | | |
| X04 | recordTransit: observedAt tương lai / lùi | Local | | | | |
| X05 | Chức năng Admin do người không phải Admin | Local | | | | |
| X06 | reportIncident: sai trạng thái, báo cáo rỗng | Local | | | | |
| X07 | tokenId không tồn tại | Local | | | | |
| X08 | Pending còn tồn sau recall | Local | | | | |
| I01 | PDF / ảnh / JSON upload–retrieve đúng byte | Backend + IPFS | | | | |
| I02 | Sửa 1 byte → frontend báo lỗi | Frontend | | | | |
| I03 | Nonce replay / hết hạn / sai domain / sai ví | Backend | | | | |
| I04 | Hai verify đồng thời | Backend | | | | |
| I05 | ACL từng file, revoke, bind | Backend | | | | |
| I06 | Ciphertext / tag sai | Backend | | | | |
| I07 | Python gửi 5 readings | IoT + DApp | | | | |
| I08 | Truy ngược đúng 2 lô | DApp + chain | | | | |
| I09 | Đổi ví / sai mạng / từ chối ký / timeout | Frontend | | | | |
| I10 | Trace dựng lại từ chain, QR hiện recall | Frontend | | | | |
| I11 | Bản triển khai end-to-end | Triển khai | | | | |

"**Sepolia**" = thuộc Bảng 15 trong KeHoach: phải chạy lại trên Sepolia và ghi kết quả thật. Ca revert chạy bằng `eth_call` / `estimateGas` để thấy lỗi mà không tốn giao dịch; chỉ gửi giao dịch với `gasLimit` cố định nếu cần receipt thất bại làm minh chứng.

---

# Phần A. Contract (C01–C18, X01–X08)

## Fixture dùng chung ⟨đề xuất⟩
Test local dùng fixture/snapshot, tăng thời gian chain để thử hết hạn, không chờ ngày thật. Assert **cả trạng thái, owner và event**, không chỉ revert.

**Tài khoản:** `admin` (ví deploy), `farmerA` (FARM-A), `farmerB` (FARM-B), `logistics`, `retailer`, `stranger` (không vai trò), `malicious` (contract độc hại, chỉ cho C12).

**Dữ liệu mẫu:** `batchCode = "COCONUT-001"`, `farmId = "FARM-A"`, `harvestGroupId = "HG-A01"`, `quantityKg = 1000`, `harvestDate = now`, `expiryDate = now + 30 ngày`. Ba hash mẫu `H = {metadataHash, certificateHash, imageHash}` là ba giá trị `bytes32` khác nhau và khác 0. `metadataCID = "bafy…"`.

| Fixture | Trạng thái sau khi dựng |
|---|---|
| `deployFixture` | Deploy; Admin `assignFarmer(farmerA,"FARM-A")`, `assignFarmer(farmerB,"FARM-B")`; cấp `LOGISTICS_ROLE` cho `logistics`, `RETAILER_ROLE` cho `retailer` |
| `createdFixture` | `deployFixture` + `farmerA.createBatch(COCONUT-001, H)` → tokenId 1, owner farmerA, lifecycle Created |
| `requestedFixture` | `createdFixture` + `farmerA.requestTransfer(1, logistics)` → requestId 1 |
| `inTransitFixture` | `requestedFixture` + `logistics.acceptTransfer(1, 1, H)` → owner logistics, InTransit |
| `requested2Fixture` | `inTransitFixture` + `logistics.requestTransfer(1, retailer)` → requestId 2 |
| `deliveredFixture` | `requested2Fixture` + `retailer.acceptTransfer(1, 2, H)` → owner retailer, Delivered |
| `soldFixture` | `deliveredFixture` + `retailer.markSold(1)` → Sold |

## C01 Tạo lô hợp lệ (F02, BR01, BR02, C18 một phần)
- **Tiền điều kiện:** `deployFixture`.
- **Bước:** `farmerA.createBatch(COCONUT-001 / FARM-A / HG-A01, quantityKg 1000, H, metadataCID)`.
- **Mong đợi:** giao dịch thành công; `BatchCreated(tokenId 1, farmerA, "FARM-A", "HG-A01", …)`; `Transfer(0x0 → farmerA, 1)`; `ownerOf(1) == farmerA`; `tokenURI(1) == "ipfs://" + metadataCID`; `getBatch(1)` có `lifecycle = Created`, `recalled = false`, đúng ba hash; `getTokenIdByCode("COCONUT-001") == 1`.

## C02 Sai role / farmId / trùng mã (BR01)
- **Tiền điều kiện:** `createdFixture` (đã có COCONUT-001).
- **Bước và mong đợi** (mỗi bước revert, `ownerOf`/số lô không đổi):
  1. `stranger.createBatch(...)` → `AccessControlUnauthorizedAccount(stranger, FARMER_ROLE)`.
  2. `logistics.createBatch(...)` (vai trò khác) → `AccessControlUnauthorizedAccount`.
  3. Admin cấp `FARMER_ROLE` cho ví `farmerC` bằng `grantRole` (không qua `assignFarmer`, nên **không có farmId**) rồi `farmerC.createBatch(...)` → `FarmNotAssigned(farmerC)`.
  4. `farmerA.createBatch(COCONUT-001, ...)` lần hai → `DuplicateBatchCode("COCONUT-001")`.
- Không mint token mới ở cả bốn bước.

## C03 Số lượng, ngày, metadata sai (BR02)
- **Tiền điều kiện:** `deployFixture`.
- **Bước và mong đợi:**
  - `quantityKg` = 0, 999, 1001 → `InvalidQuantity(giá trị)`.
  - `expiryDate == now` hoặc `expiryDate < now` → `InvalidDates`.
  - `harvestDate > now` (tương lai) → `InvalidDates`.
  - `batchCode` rỗng → `EmptyBatchCode`.
  - `metadataCID` rỗng hoặc một hash bằng 0 → `EmptyMetadata`.
- Không có `BatchCreated`, không mint, không tạo lô.

## C04 Request hợp lệ (F03)
- **Tiền điều kiện:** `createdFixture`.
- **Bước:** `farmerA.requestTransfer(1, logistics)`.
- **Mong đợi:** `TransferRequested(1, farmerA, logistics, requestId 1)`; `getPendingTransfer(1)` = `{requestId 1, from farmerA, to logistics, active true}`; **`ownerOf(1)` vẫn là farmerA; `lifecycle` vẫn Created; không có event `Transfer`**.

## C05 Request sai người / tuyến / đã có pending (BR03, BR04)
- **Tiền điều kiện:** `createdFixture`.
- **Bước và mong đợi:**
  1. `stranger.requestTransfer(1, logistics)` → `NotTokenOwner(1, stranger)`.
  2. `logistics.requestTransfer(1, retailer)` (không phải chủ) → `NotTokenOwner`.
  3. `farmerA.requestTransfer(1, retailer)` (nhảy tuyến, xem X03) → `InvalidRoute(farmerA, retailer)`.
  4. `farmerA.requestTransfer(1, logistics)` hai lần liên tiếp: lần hai → `PendingExists(1, 1)`.
- `getPendingTransfer(1)` vẫn là yêu cầu đầu tiên.

## C06 Accept đúng 3 hash (F03, BR04, BR08)
- **Tiền điều kiện:** `requestedFixture`.
- **Bước:** `logistics.acceptTransfer(1, 1, H)`.
- **Mong đợi:** `TransferAccepted(1, farmerA, logistics, 1, H…)` + `Transfer(farmerA → logistics, 1)`; `ownerOf(1) == logistics`; `lifecycle = InTransit`; `getPendingTransfer(1).active == false`.
- **Lặp lại ở nhánh Retailer:** từ `requested2Fixture`, `retailer.acceptTransfer(1, 2, H)` → `ownerOf == retailer`, `lifecycle = Delivered`.

## C07 Accept sai một hash (BR08)
- **Tiền điều kiện:** `requestedFixture`.
- **Bước:** gọi `acceptTransfer` ba lần, mỗi lần sai đúng một hash (metadata, certificate, image).
- **Mong đợi:** `HashMismatch(0)`, `HashMismatch(1)`, `HashMismatch(2)` tương ứng. Sau mỗi lần: `ownerOf(1) == farmerA`, `lifecycle == Created`, `getPendingTransfer(1).active == true`. **Revert nguyên giao dịch**, không có thay đổi một phần.
- Lặp lại với nhánh Retailer (`requested2Fixture`).

## C08 Accept request cũ / đã đóng (BR03)
- **Bước và mong đợi:**
  1. Từ `requestedFixture`: `farmerA.cancelTransfer(1, 1)` rồi `logistics.acceptTransfer(1, 1, H)` → `NoActiveRequest(1)`.
  2. Cancel, tạo request mới (requestId 2), rồi accept bằng `requestId 1` → `StaleRequest(1, 2)`.
  3. Accept thành công một lần rồi accept lại cùng request → `NoActiveRequest`.
- Owner và lifecycle không đổi sau các lần bị chặn.

## C09 Reject / cancel đúng quyền (F03)
- **Tiền điều kiện:** `requestedFixture`.
- **Bước và mong đợi:**
  1. `stranger.rejectTransfer(1, 1)` → `NotRecipient(stranger, logistics)`.
  2. `farmerA.rejectTransfer(1, 1)` (người gửi không phải người nhận) → `NotRecipient`.
  3. `stranger.cancelTransfer(1, 1)` → `NotSender(stranger, farmerA)`.
  4. `logistics.cancelTransfer(1, 1)` → `NotSender`.
  5. `logistics.rejectTransfer(1, 1)` → thành công, `TransferRejected`, `active = false`, owner không đổi.
  6. Dựng lại request rồi `farmerA.cancelTransfer(...)` → thành công, `TransferCancelled`.

## C10 Role bị thu hồi giữa request và accept (BR04)
- **Tiền điều kiện:** `requestedFixture`.
- **Bước:** Admin `revokeRole(LOGISTICS_ROLE, logistics)`; `logistics.acceptTransfer(1, 1, H)`.
- **Mong đợi:** revert (`RoleNoLongerValid(logistics, LOGISTICS_ROLE)` hoặc `AccessControl…` tùy thứ tự kiểm; chốt khi viết contract, xem Thứ tự kiểm tra); owner vẫn farmerA.
- **Biến thể:** thu hồi `FARMER_ROLE` của **người gửi** rồi accept → cũng `RoleNoLongerValid(farmerA, FARMER_ROLE)` (KeHoach: kiểm vai trò cả hai bên lúc accept, không chỉ lúc request).

## C11 Né luồng bằng transfer / approval (BR04)
- **Tiền điều kiện:** `createdFixture` (và `deliveredFixture` cho biến thể).
- **Bước và mong đợi (tất cả → `DirectTransferDisabled`, owner không đổi):**
  - `farmerA.transferFrom(farmerA, logistics, 1)`.
  - `farmerA.safeTransferFrom(farmerA, logistics, 1)` (bản 3 tham số).
  - `farmerA.safeTransferFrom(farmerA, logistics, 1, "0x")` (bản 4 tham số).
  - `farmerA.approve(logistics, 1)` rồi `logistics.transferFrom(...)`: `approve` đã revert nên không tới bước transfer.
  - `farmerA.setApprovalForAll(logistics, true)`.
  - Admin gọi `transferFrom` hộ → bị chặn (không có hàm chuyển hộ của Admin).

## C12 Callback bên nhận / reentrancy
- **Tiền điều kiện:** `deployFixture` + contract `MaliciousReceiver` (mock) được Admin cấp `LOGISTICS_ROLE`; Farmer tạo lô rồi request tới `MaliciousReceiver`.
- **Bước:** `MaliciousReceiver` chấp nhận qua `acceptTransfer`; trong `onERC721Received` nó cố gọi lại `acceptTransfer`, `requestTransfer`, `markSold`, `recordTransit`.
- **Mong đợi:** các lời gọi lồng nhau revert (`ReentrancyGuardReentrantCall` hoặc lỗi nghiệp vụ vì pending đã đóng); cuối cùng **chỉ một lần chuyển** xảy ra, `ownerOf == MaliciousReceiver`, không có `Transfer` thừa, pending đã `active = false` **trước** callback.
- Kiểm cả hai overload `safeTransferFrom` đã chặn (C11).

## C13 recordTransit (F04, BR06)
- **Tiền điều kiện:** `inTransitFixture`.
- **Bước và mong đợi:**
  1. `logistics.recordTransit(1, readingId 1, 1000, observedAt, "10.77,106.70")` → thành công, `TransitRecorded(1, 1, 1000, observedAt, …)`; `tempCenti 1000` nghĩa là 10,00°C.
  2. Gửi lại cùng `readingId 1` → `ReadingUsed(1, 1)`.
  3. `stranger.recordTransit(...)` → `NotTokenOwner`.
  4. `farmerA.recordTransit(...)` (đã không còn là chủ) → `NotTokenOwner`.
  5. Từ `createdFixture` (chủ là Farmer, chưa InTransit) → `NotTokenOwner`.
  6. Gửi 5 reading (10, 12, 18, 13, 11°C) → 5 event; mẫu 18°C chỉ là dữ liệu, contract **không** tự cảnh báo (cảnh báo ở DApp/F08).

## C14 markSold (F05)
- **Tiền điều kiện:** `deliveredFixture`.
- **Bước và mong đợi:**
  1. `retailer.markSold(1)` → `lifecycle = Sold`, `BatchSold(1, retailer, soldAt)`; owner vẫn retailer.
  2. Gọi lại → `BatchLocked(1, Sold)` (thứ tự kiểm: khóa lô trước lifecycle).
  3. Từ `inTransitFixture` (chưa Delivered): `retailer.markSold(1)` → `NotTokenOwner` (retailer chưa giữ lô).
  4. Từ `deliveredFixture`: `stranger.markSold(1)` → `NotTokenOwner`.

## C15 Khóa lô: Sold / expired / recalled (BR05)
- **Bước và mong đợi:** với mỗi trạng thái khóa, các thao tác sau đều → `BatchLocked(tokenId, reason)` và không đổi trạng thái:

| Trạng thái khóa | `requestTransfer` | `acceptTransfer` | `recordTransit` | `markSold` |
|---|---|---|---|---|
| Sold (từ `soldFixture`) | chặn | n/a | chặn | chặn |
| Expired (tăng thời gian qua `expiryDate`) | chặn | chặn | chặn | chặn |
| Recalled (Admin recall) | chặn | chặn | chặn | chặn |

- **Vẫn được phép** (kiểm riêng): `rejectTransfer`, `cancelTransfer`, `reportIncident`, `recallBatch`.
- Lô Expired: lifecycle gốc **vẫn là** giá trị cũ (Created/InTransit/Delivered); `isExpired(1) == true`.

## C16 reportIncident (F10, BR07)
- **Tiền điều kiện:** `deliveredFixture`.
- **Bước và mong đợi:**
  1. `retailer.reportIncident(1, reportCID, reportHash)` → `IncidentReported(incidentId 1, 1, retailer, …)`.
  2. Sau `markSold`, báo lại → thành công (incidentId 2).
  3. `stranger.reportIncident(...)` → `NotTokenOwner`.
  4. `farmerA.reportIncident(...)` → `NotTokenOwner`.
  5. Sau khi lô hết hạn hoặc đã recall, Retailer vẫn báo được (BR07).
  6. Incident cũ không bị sửa hay xóa khi có báo cáo mới.

## C17 Admin recall lô Sold (F09, BR07)
- **Tiền điều kiện:** `soldFixture` + một incident đã ghi (incidentId 1).
- **Bước:** `admin.recallBatch(1, 1, reasonCID, reasonHash)`.
- **Mong đợi:** `BatchRecalled(1, 1, admin, reasonCID, reasonHash)`; `getBatch(1).recalled == true`; **`lifecycle` vẫn Sold, owner vẫn retailer**; không xóa provenance (event cũ vẫn truy xuất được). Sau đó: `AlreadyRecalled(1)` nếu recall lần hai.

## C18 tokenURI và lịch sử Transfer (NFT)
- **Tiền điều kiện:** `deliveredFixture`.
- **Mong đợi:** `tokenURI(1) == "ipfs://" + metadataCID` (không dùng link gateway); dựng lịch sử từ log `Transfer` theo `tokenId = 1` được đúng 3 bản ghi: `0x0 → farmerA`, `farmerA → logistics`, `logistics → retailer`; chủ cuối của lịch sử **bằng `ownerOf(1)`**. Mỗi bản ghi kèm `blockNumber`, `transactionIndex`, `logIndex`, `txHash`. Một lần bàn giao không bị tính thành hai lần đổi chủ (`TransferAccepted` cùng `Transfer`).

---

## X01 recall: incident không tồn tại / lý do rỗng (BR07)
- **Tiền điều kiện:** `soldFixture`, chưa có incident nào.
- **Bước và mong đợi:** `admin.recallBatch(1, 99, reasonCID, reasonHash)` → `UnknownIncident(99)`; `recallBatch(1, 0, …)` → `UnknownIncident(0)`; sau khi có incident 1, `recallBatch(1, 1, "", 0)` → `EmptyReason`. `recalled` vẫn false.

## X02 recall không lan sang lô khác; recall lặp (BR07, F09)
- **Tiền điều kiện:** dựng bốn lô theo KeHoach bảng 12: COCONUT-001 và -002 (FARM-A/HG-A01), -003 (FARM-A/HG-A02), -004 (FARM-B/HG-B01); Retailer báo sự cố trên lô 001 (incidentId 1).
- **Bước và mong đợi:** `recallBatch(1, 1, …)` và `recallBatch(2, 1, …)` (incident thuộc lô khác lô được thu hồi là **hợp lệ**). Lô 3 và 4: `getBatch(3).recalled == false`, `getBatch(4).recalled == false`; `recallBatch` lặp trên lô 1 → `AlreadyRecalled(1)`.

## X03 Tuyến sai (BR04)
- **Bước và mong đợi:**
  1. Từ `createdFixture`: `farmerA.requestTransfer(1, retailer)` → `InvalidRoute`.
  2. `farmerA.requestTransfer(1, stranger)` (người nhận không có vai trò) → `InvalidRoute`.
  3. `farmerA.requestTransfer(1, farmerB)` → `InvalidRoute`.
  4. Từ `deliveredFixture`: `retailer.requestTransfer(1, logistics)` → `InvalidRoute` (không còn tuyến sau Delivered).
  5. Từ `inTransitFixture`: `logistics.requestTransfer(1, farmerA)` (ngược chiều) → `InvalidRoute`.

## X04 recordTransit: thời điểm quan sát (BR06)
- **Tiền điều kiện:** `inTransitFixture`.
- **Bước và mong đợi:** `observedAt = now + 1 giờ` → `InvalidObservedAt`; ghi reading với `observedAt = T`, rồi ghi reading mới (readingId khác) với `observedAt = T - 1` → `InvalidObservedAt(T-1, T)`; `observedAt == T` (bằng) → **cho phép** (KeHoach: không lùi, nên bằng là được).

## X05 Chức năng Admin (F01)
- **Tiền điều kiện:** `deployFixture`.
- **Bước và mong đợi:** `stranger.assignFarmer(...)`, `farmerA.grantRole(...)`, `farmerA.assignFarmer(...)` → `AccessControlUnauthorizedAccount`; `admin.assignFarmer(0x0, "FARM-C")` → `ZeroAddress`; `admin.assignFarmer(farmerC, "")` → `EmptyFarmId`; `admin.assignFarmer(farmerC, "FARM-C")` thành công → `FarmerAssigned`, `RoleGranted`, `farmIdOf(farmerC) == "FARM-C"`; `admin.revokeRole(FARMER_ROLE, farmerC)` → `RoleRevoked`.

## X06 reportIncident: sai trạng thái, báo cáo rỗng (F10)
- **Bước và mong đợi:**
  1. Từ `inTransitFixture` (Retailer chưa giữ lô): `retailer.reportIncident(1, reportCID, reportHash)` → `NotTokenOwner(1, retailer)`.
  2. Từ `createdFixture`: `retailer.reportIncident(...)` → `NotTokenOwner`.
  3. Từ `deliveredFixture`: `retailer.reportIncident(1, "", reportHash)` → `EmptyReport`; `retailer.reportIncident(1, reportCID, 0x0)` → `EmptyReport`.
  4. Không có incident nào được ghi ở cả ba bước (`nextIncidentId` không đổi).

## X07 tokenId không tồn tại
- **Bước và mong đợi:** gọi `requestTransfer`, `acceptTransfer`, `rejectTransfer`, `cancelTransfer`, `recordTransit`, `markSold`, `reportIncident`, `recallBatch`, `getBatch`, `isExpired` với tokenId 0 và 999 → `BatchNotFound`.

## X08 Pending còn tồn sau recall (BR05)
- **Tiền điều kiện:** `requestedFixture`.
- **Bước và mong đợi:** `admin.recallBatch(1, incidentId, …)` (cần một incident hợp lệ, có thể từ lô khác); `logistics.acceptTransfer(1, 1, H)` → `BatchLocked(1, Recalled)`; `farmerA.cancelTransfer(1, 1)` → **thành công**; hoặc `logistics.rejectTransfer(1, 1)` → thành công. Lô thu hồi không tự xóa pending (KeHoach 16.1 bước 6).

---

# Phần B. Tích hợp và bảo mật (I01–I11)

**Môi trường backend ⟨đề xuất⟩:** pytest + `FastAPI TestClient/httpx` trên **PostgreSQL thật, database `food_test`** (`TEST_DATABASE_URL`, cùng container với `food_dev` nhưng role và database riêng; không dùng SQLite vì I04 cần `UPDATE` điều kiện nguyên tử của Postgres). Fixture pytest phải từ chối chạy nếu tên database không kết thúc bằng `_test`, rồi chạy `alembic upgrade head` trên `food_test` trước test. Phần đọc chain đi qua một adapter có thể thay bằng bản giả (danh sách vai trò, receipt, event) cho test đơn vị; I05 (bind) và I11 chạy với **Hardhat node thật** và Sepolia. Gợi ý tên file: `backend/tests/test_auth.py`, `test_documents.py`, `test_bind.py`, `test_grants.py`, `test_crypto.py`.

## I01 Upload và retrieve đúng byte (F07, rubric IPFS)
- **Bước:** upload `certificate.pdf`, `batch.jpg`, `metadata.json` qua `POST /documents`; tải lại từ IPFS bằng `cid`.
- **Mong đợi:** SHA-256 của byte tải về **bằng** `sha256` backend trả; CID khác SHA-256 (không dùng CID làm hash); lưu `cid`, kích thước, hash, MIME vào manifest thử nghiệm. Consumer không ví mở được chứng chỉ gốc và ảnh lô từ liên kết IPFS trên trang trace (phần frontend). Thử mất gateway → thông báo lỗi, **không** tự báo xác minh thành công.
- **Ca âm backend:** file > 10 MB → 413; PDF giả đuôi `.pdf` nhưng nội dung khác → 415.

## I02 Sửa 1 byte (frontend)
- **Bước:** thay một byte trong file mẫu trên IPFS (hoặc dùng bản đã sửa) rồi mở màn hình nhận hàng.
- **Mong đợi:** frontend phát hiện lệch hash, khóa nút nhận, cho tải lại; gọi trực tiếp `acceptTransfer` với hash sai thì contract revert `HashMismatch` (C07). Không tuyên bố các phép kiểm này loại bỏ mọi gian lận.

## I03 Đăng nhập chống phát lại (F07, KeHoach 19)
- **Bước và mong đợi (đều `401`, không có phiên mới):**
  1. Dùng lại một nonce đã verify thành công → `NONCE_INVALID`.
  2. Verify sau khi nonce hết hạn (chỉnh đồng hồ/DB) → `NONCE_INVALID`.
  3. Chữ ký của ví A nhưng khai `wallet = B` → `SIGNATURE_INVALID` hoặc `NONCE_INVALID`.
  4. Challenge tạo cho domain khác (`AUTH_DOMAIN` đổi) hoặc sai `chainId` → từ chối.
  5. Nonce không tồn tại → `NONCE_INVALID`.
  6. Chữ ký trên thông điệp bị sửa một ký tự → `SIGNATURE_INVALID`.
  7. Vai trò bị thu hồi **sau khi đăng nhập** → lần đọc tài liệu kế tiếp bị `403` (kiểm lại on-chain, không tin vai trò lúc đăng nhập).
  8. Logout rồi dùng lại token → `401`.

## I04 Hai verify đồng thời
- **Bước:** tạo một challenge, gửi **hai** `POST /auth/verify` song song (hai luồng/hai kết nối) với cùng chữ ký hợp lệ.
- **Mong đợi:** đúng **một** request nhận `200`, request còn lại `401 NONCE_INVALID`; `auth_nonces.used_at` được đặt đúng một lần; chỉ **một** dòng mới trong `sessions`. (Câu `UPDATE … WHERE used_at IS NULL AND expires_at > now()` phải là nguyên tử.)

## I05 ACL theo tài liệu và bind (F07, rubric IPFS)
- **Tiền điều kiện:** Farmer A upload `invoice` (private) cho lô COCONUT-001; grant cho `logistics` và `retailer`.
- **Bước và mong đợi:**

| Người đọc | Kết quả |
|---|---|
| Farmer A (uploader) | `200`, file giải mã đúng |
| Logistics, Retailer (có grant) | `200` |
| Farmer B | `403 ACCESS_DENIED` |
| Admin (không có grant) | `403 ACCESS_DENIED` |
| Consumer / không đăng nhập | `401` |
| Ví có grant nhưng bị thu hồi vai trò on-chain | `403` |
| Sau `DELETE /grants/{wallet}` | lần tải **sau** bị `403`; file đã tải trước đó không thu hồi được |

  - Admin gọi `POST /grants` cho chính mình → `403 NOT_UPLOADER`.
  - Truy cập chéo `documentId` của người khác → `403`.
  - **Bind (KeHoach 19 bổ sung I05):** bind draft đúng receipt thành công → `200`; receipt sai contract / sai uploader / sai hash → `422`; bind chéo sang lô khác → `409 ALREADY_BOUND`; **gọi bind lặp** cùng dữ liệu → `200`, không tạo bản ghi trùng; bind khi chưa có receipt → `422`; người không phải uploader → `403`.

## I06 Ciphertext / tag sai (F07)
- **Bước:** sửa một byte của ciphertext, hoặc của tag, hoặc của AAD đã lưu, rồi `GET /documents/{id}/content` bằng ví có quyền.
- **Mong đợi:** `502 CIPHERTEXT_INVALID`; **không có byte plaintext nào** trong response (kể cả một phần); không ghi khóa vào log. File nguyên vẹn thì giải mã đúng và `X-Document-Sha256` khớp hash bản rõ.

## I07 Python gửi 5 readings (F04, F08)
- **Bước:** `simulate.py` gửi 5 reading (10, 12, 18, 13, 11°C) bằng ví Logistics; mở DApp.
- **Mong đợi:** DApp thấy 5 event `TransitRecorded` cùng txHash, đơn vị đúng (tempCenti ÷ 100); **một** cảnh báo cho mẫu 18°C (ngưỡng minh họa 8–15°C, không kết luận nhiễm khuẩn). `--dry-run` không phát giao dịch.

## I08 Truy ngược (F09)
- **Mong đợi:** từ COCONUT-001 dẫn về FARM-A / HG-A01 và tìm ra **đúng COCONUT-002**; COCONUT-003 (khác nhóm) và COCONUT-004 (khác farm) **không** tự bị thu hồi; kết quả là danh sách xem xét, chưa phải kết luận nhiễm khuẩn.

## I09 Giao dịch lỗi không báo thành công giả (frontend)
- **Bước:** đổi ví giữa chừng; chọn sai mạng; từ chối ký; làm giao dịch timeout.
- **Mong đợi:** UI không báo thành công giả; phân biệt "người dùng từ chối ký" với "contract revert"; sau timeout truy vấn lại `txHash`/receipt trước khi kết luận; đổi ví xóa dữ liệu phiên cũ (kể cả token).

## I10 Trace dựng lại từ chain (F06)
- **Mong đợi:** tải lại trang trace trên trình duyệt sạch (không cache) dựng lịch sử trực tiếp từ chain, khớp `ownerOf`; QR hiện cảnh báo thu hồi kể cả sau Sold; link Etherscan của từng txHash mở đúng giao dịch; không cache event trong PostgreSQL.

## I11 Bản triển khai end-to-end
- **Bước và mong đợi:** HTTPS; CORS chỉ cho phép đúng origin frontend; đăng nhập ví → upload → tải tài liệu riêng; trang trace mở được **từ điện thoại**; cùng một ví hợp lệ đọc được file từ **hai thiết bị** qua cùng backend triển khai; `/health` trả `{"status":"ok"}`; địa chỉ contract giống nhau ở frontend, backend, iot. Chạy trước buổi quay video; ghi lại ngày, commit, URL, số lỗi và nguyên nhân theo KeHoach 25.2.

---

# Truy vết yêu cầu → code → test → minh chứng

| Quy tắc | Ca test chính | Ca âm (từ chối) |
|---|---|---|
| BR01 quyền tạo lô, farmId, mã duy nhất | C01 | C02, X05 |
| BR02 quantityKg = 1000, ngày hợp lệ | C01 | C03 |
| BR03 một lô một NFT, requestId | C04, C06 | C05, C08 |
| BR04 tuyến và vai trò cả hai bên | C06 | C05, C09, C10, X03 |
| BR05 khóa Sold / expired / recalled | C15 | C15, X08 |
| BR06 recordTransit | C13 | C13, X04 |
| BR07 sự cố và thu hồi | C16, C17 | C16, X01, X02 |
| BR08 hash nhận hàng | C06 | C07, I02 |
| ERC-721 chặn né luồng | C11 | C11, C12 |
| NFT, tokenURI, lịch sử Transfer | C18 | I10 |
| Đăng nhập chống phát lại | I03 | I03, I04 |
| ACL tài liệu riêng | I05 | I05 |
| Mã hóa AES-GCM | I06 | I06 |

## Ghi chú về lỗi `WrongLifecycle` (đã chốt bỏ, 21/10/2026)
`recordTransit`, `markSold`, `reportIncident` kiểm chủ sở hữu trước, mà chủ sở hữu luôn đi kèm đúng lifecycle (Logistics chỉ giữ lô khi InTransit; Retailer chỉ giữ khi Delivered hoặc Sold, và Sold bị `BatchLocked` chặn trước). Nên không có nhánh `WrongLifecycle`; các ca C13, C14, X06 dùng `NotTokenOwner`.
