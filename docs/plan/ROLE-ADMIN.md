# ROLE-ADMIN — việc cần làm cho vai trò Admin

Mã việc và ô tick nằm ở `CODE.md`; file này chỉ chỉ ra việc gì thuộc Admin và làm theo cách nào. Làm theo mẫu **Farmer** đã chạy thật.

## Môi trường chạy

Mỗi người tự dựng môi trường local của mình: Hardhat node, `seed_local.py` (cần `PINATA_JWT` của riêng bạn trong `.env`), PostgreSQL, backend và frontend. Các bước ở `docs/environment.md` (mục 9 và 10). Chain trong bộ nhớ từng máy nên không dùng chung được. Đăng nhập bằng cách nhập khóa riêng của tài khoản Hardhat vào MetaMask (bảng ví ở `TESTCASE.md`, mục 0.1); sau khi dựng lại chain thì xóa dữ liệu hoạt động và số nonce trong MetaMask. Khóa Hardhat là khóa công khai, chỉ dùng local, không dùng trên Sepolia.

## Mục tiêu

Admin (ví #0 Hardhat khi chạy local, người triển khai contract) cấp và thu hồi vai trò, gán farmId cho Farmer, xem các sự cố, truy ngược lô liên quan và thu hồi từng lô có lý do. Mọi số liệu đọc từ contract, ghi bằng MetaMask. Không dùng dữ liệu mẫu.

## Hiện trạng

- Có sẵn trang trong `frontend/src/features/admin/` (Overview, Roles, Farms, Incidents, IncidentDetail, Batches, BatchDetail) với **dữ liệu mẫu** (`batchFixtures.ts`, `incidentFixtures.ts`, `incidentStore.ts`, `roleStore.ts`).
- `admin/TxProgressModal.tsx` và `admin/TemperatureChart.tsx` trùng với bản dùng chung ở `src/components/` và `features/public/components/`. Khi nối thật thì bỏ bản trùng.
- **Backend đã sẵn sàng (mã `P06-16`):** `POST /documents` nhận `doc_type = recall_reason` (chỉ ví có ADMIN_ROLE, PDF hoặc JSON, công khai). Quy trình thu hồi: upload lý do, lấy `cid` và `sha256`, gọi `recallBatch(tokenId, incidentId, reasonCID, reasonHash)`, rồi `POST /documents/{id}/bind` với `token_id` (không cần txHash). Backend đã có test; chưa thử cùng giao diện Admin.

## Việc cần làm (mã trong CODE.md)

| Mã | Việc | Ghi chú |
|---|---|---|
| `P05-16` | Màn **Vai trò** (`/admin/roles`) và **Trang trại** (`/admin/farms`): `grantRole`, `revokeRole`, `assignFarmer(farmer, farmId)` | Đọc danh sách thành viên bằng `listRoleMembers` (`services/roles.ts`). Phải có event. Ví chưa gán farmId thì Farmer chưa tạo lô được |
| `P05-17` | Màn **Sự cố** và **Chi tiết sự cố**: đọc event `IncidentReported` và `getIncident`; hiện báo cáo (CID, hash, link IPFS) và lô liên quan | Không có endpoint backend liệt kê sự cố; đọc từ chain, theo cách `publicChainReader.ts` làm |
| `P06-05` | Truy ngược: từ tokenId đọc `Transfer`, `TransitRecorded`, `BatchCreated` để ra Farmer, farmId, harvestGroupId | Hiển thị lý do lô được đưa vào diện xem xét |
| `P06-06` | Tìm lô cùng `farmId` + `harvestGroupId`; phân biệt khác nhóm, khác trang trại | Đúng 2 lô (COCONUT-001, 002); seed đã có đủ nhóm lô này |
| `P06-07` | **Thu hồi** từng lô: `recallBatch(tokenId, incidentId, reasonCID, reasonHash)` | Không thu hồi cả trang trại. Upload lý do qua backend (`recall_reason`, xem mục Hiện trạng). Mẫu PDF: `backend/scripts/sample_data/recall-reason.pdf` |
| `P06-08` | Kiểm QR lô thu hồi hiện cảnh báo kể cả Sold; giao dịch mới bị chặn | Trang trace đã có cảnh báo; cần thử sau khi thu hồi thật |
| `P06-09` | Đo thời gian truy ngược, ghi số event và RPC | Ghi số liệu thật, không ước lượng |
| `P06-15` | Kiểm truy ngược COCONUT-001 → 002; 003, 004 không bị thu hồi (I08) | |
| `P05-09` | Hiện txHash và link Etherscan sau mỗi giao dịch | Dùng `TxProgressModal` dùng chung |

## Dùng lại

- Cùng bộ công cụ với Logistics (xem `ROLE-LOGISTICS.md`): `tx.ts`, `TxProgressModal`, `useStepFlow`, `chainLogs.ts`, `lib/hash.ts`, `roles.ts`.
- Đọc sự kiện và dựng timeline: `features/public/services/publicChainReader.ts` (đã có `IncidentReported`, `BatchRecalled`).
- Dữ liệu thử: `backend\scripts\seed_local.py`. Có sự cố #1 (COCONUT-005, đã thu hồi). Nhóm truy ngược đã đủ: COCONUT-001 và 002 cùng FARM-A + HG-A01, 003 cùng FARM-A khác nhóm (HG-A02), 004 thuộc FARM-B. Seed chưa có sự cố cho 001, nên Retailer phải báo sự cố ở 001 trước (luồng RD trong `TESTCASE.md`) thì Admin mới truy ngược ra 002.
- Admin không mặc nhiên đọc hóa đơn riêng (xem `docs/notes/api-spec.md`).

## Cách làm

1. Làm Vai trò và Trang trại trước (không phụ thuộc vai trò khác), sau đó Sự cố và Thu hồi (cần Retailer báo sự cố, hoặc dùng sự cố seed sẵn).
2. Bỏ fixtures và các store cục bộ, nối từng trang vào contract.
3. Kiểm tra theo Phần 4 của `TESTCASE.md` (mã `AD`) bằng MetaMask thật với ví #0: cấp vai trò cho một ví mới, gán farmId, thu hồi lô, rồi xem trang trace.
4. Khi chạy thật xong thì báo để tick mã trong `CODE.md`. Commit và PR nhắc mã việc.

## Xong khi

- Cấp, thu hồi vai trò và gán farmId có event, và ví đó vào được đúng trang.
- Thu hồi từng lô có lý do, không ảnh hưởng lô khác; QR hiện cảnh báo, kể cả lô Sold.
- Truy ngược ra đúng 2 lô (001, 002); 003, 004 không bị đụng.
- Ví không phải Admin không vào được các màn này.
