# ROLE-LOGISTICS — việc cần làm cho vai trò Logistics

Mã việc và ô tick nằm ở `CODE.md`; file này chỉ chỉ ra việc gì thuộc Logistics và làm theo cách nào. Làm theo mẫu **Farmer** đã chạy thật.

## Mục tiêu

Người dùng Logistics đăng nhập bằng ví (ví #3 Hardhat khi chạy local), nhận lô từ Farmer sau khi xác minh hồ sơ, ghi nhiệt độ khi vận chuyển, rồi đề nghị bàn giao cho Retailer. Mọi số liệu đọc từ contract, ghi bằng MetaMask. Không dùng dữ liệu mẫu.

## Hiện trạng

- Có sẵn 5 trang trong `frontend/src/features/logistics/` (Overview, Incoming, Batches, BatchDetail, Outgoing) nhưng chỉ là giao diện với **dữ liệu mẫu**, chưa gọi contract.
- Contract, test và backend đã đủ cho vai trò này. Không cần sửa contract.

## Việc cần làm (mã trong CODE.md)

| Mã | Việc | Ghi chú |
|---|---|---|
| `P05-06` | Màn **Chờ nhận** (`/logistics/incoming`): đọc pending transfer gửi tới ví, tải metadata, certificate, ảnh từ IPFS, tính SHA-256, so với 3 hash on-chain, rồi `acceptTransfer(tokenId, requestId, hashes)` | Hash sai hoặc lỗi tải thì khóa nút nhận, cho tải lại. Dùng lại `lib/hash.ts` và phần đọc hồ sơ ở `features/public/services/publicChainReader.ts`. Màn này Retailer dùng chung, nên làm thành component dùng chung |
| `P05-05` (phần Logistics) | Màn **Bàn giao đi** (`/logistics/outgoing`): `requestTransfer` tới Retailer, `cancelTransfer`; từ chối lô tới bằng `rejectTransfer` | Mẫu: `FarmerTransfersPage.tsx` |
| `P05-07` | Màn **Lô đang giữ** và **Chi tiết lô**: danh sách lô ví đang giữ, lịch sử readings (event `TransitRecorded`); ghi nhiệt độ thủ công bằng `recordTransit` | Chỉ thao tác lô đang giữ và đang InTransit. `readingId` không được trùng. `tempCenti` là số nguyên (1250 = 12,50°C) |
| `P05-09` | Hiện txHash và link Etherscan sau mỗi giao dịch | Dùng `TxProgressModal` có sẵn |
| `P06-04` | Cảnh báo ngoài ngưỡng 8–15°C trên trang Chi tiết lô | Có sẵn component biểu đồ ở trang trace (`TemperatureChart.tsx`); chỉ cảnh báo, không kết luận nhiễm khuẩn |
| `OP-02` | (Tùy chọn) bộ lọc lịch sử | Làm sau cùng |

## Dùng lại

- Đọc chain: viết `logisticsChain.ts` theo `features/farmer/services/farmerChain.ts` (`readFarmerSnapshot`), hook theo `useFarmerSnapshot.ts`, kiểu dữ liệu theo `types.ts` của Farmer.
- Ghi chain: `services/tx.ts` (`sendTransaction`, lỗi từ chối ký khác revert), `components/TxProgressModal.tsx`, `hooks/useStepFlow.ts`.
- Event và quét log: `services/chainLogs.ts` (tự chia nhỏ khoảng khi RPC giới hạn).
- Đăng nhập, vai trò, phiên: `app/session.tsx`, `services/roles.ts`. Trang chỉ dùng được khi phiên là ví thật.
- Dữ liệu thử: `backend\scripts\seed_local.py`. Logistics đang giữ COCONUT-003 (InTransit, đã có 5 readings, readingId 1 đến 5 đã dùng). Chưa có yêu cầu nào đang chờ: Farmer A phải tạo lô mới và gửi yêu cầu (luồng C và D trong `TESTCASE.md`) thì Logistics mới có lô để nhận.
- Hàm contract: `requestTransfer`, `acceptTransfer`, `rejectTransfer`, `cancelTransfer`, `recordTransit`; lỗi và thứ tự kiểm tra ở `docs/notes/contract-spec.md`.

## Cách làm

1. Bỏ fixtures, nối từng trang vào contract, giữ nguyên bố cục hiện có.
2. Nếu cần ghi chú thêm thì ghi vào `docs/notes/`, không tạo tài liệu mới ngoài danh sách.
3. Kiểm tra theo Phần 2 của `TESTCASE.md` (mã `LG`) bằng MetaMask thật với ví #3: nhận lô, thử hash sai (sửa 1 byte), ghi 2–3 readings, đề nghị giao Retailer.
4. Khi chạy thật xong thì báo để tick mã trong `CODE.md`. Commit và PR nhắc mã việc.

## Xong khi

- Lô Farmer đề nghị xuất hiện ở Chờ nhận, nhận được khi hash khớp và bị khóa khi sai.
- Sau khi nhận, lô ở Lô đang giữ với trạng thái InTransit; readings hiện đúng đơn vị.
- Đề nghị giao Retailer tạo được, hủy được.
- Chuyển ví khác thì không thấy lô của ví này.
