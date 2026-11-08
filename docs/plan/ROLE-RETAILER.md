# ROLE-RETAILER — việc cần làm cho vai trò Retailer

Mã việc và ô tick nằm ở `CODE.md`; file này chỉ chỉ ra việc gì thuộc Retailer và làm theo cách nào. Làm theo mẫu **Farmer** đã chạy thật, và dùng chung màn nhận hàng với Logistics.

## Mục tiêu

Người dùng Retailer đăng nhập bằng ví (ví #4 Hardhat khi chạy local), nhận lô từ Logistics sau khi xác minh hồ sơ, ghi nhận bán hết, và báo sự cố kèm bằng chứng trên IPFS. Mọi số liệu đọc từ contract, ghi bằng MetaMask. Không dùng dữ liệu mẫu.

## Hiện trạng

- Có sẵn 6 trang trong `frontend/src/features/retailer/` (Overview, Incoming, Batches, BatchDetail, Sales, NewIncident) với **dữ liệu mẫu**, chưa gọi contract.
- Backend đã nhận `doc_type = incident_report` (chỉ ví có RETAILER_ROLE và đang giữ lô mới upload được; có test). Contract đã đủ. Không cần sửa backend.

## Việc cần làm (mã trong CODE.md)

| Mã | Việc | Ghi chú |
|---|---|---|
| `P05-06` | Màn **Chờ nhận** (`/retailer/incoming`): xác minh metadata, certificate, ảnh rồi `acceptTransfer(tokenId, requestId, hashes)` | Dùng chung component với Logistics (Logistics làm trước thì dùng lại, không viết lại). Hash sai khóa nút nhận |
| `P05-08` | Màn **Bán hết** (`/retailer/sales`): `markSold(tokenId)` | Chỉ lô Delivered, chưa hết hạn, chưa thu hồi. Lô bị khóa thì nút bị vô hiệu kèm lý do |
| `P05-07` (phần đọc) | Màn **Lô đang giữ** và **Chi tiết lô** đọc từ contract | Hiện nhãn hết hạn cạnh trạng thái gốc, cảnh báo thu hồi |
| `P06-03` | Màn **Báo sự cố mới** (`/retailer/incidents/new`): nhập mô tả, upload báo cáo qua `POST /documents` (`doc_type=incident_report`), rồi `reportIncident(tokenId, reportCID, reportHash)` | Chỉ lô Delivered hoặc Sold. Hash lấy từ phản hồi backend, đối chiếu với hash tự tính. Mẫu PDF: `backend/scripts/sample_data/incident-report.pdf` |
| `P05-09` | Hiện txHash và link Etherscan sau mỗi giao dịch | Dùng `TxProgressModal` có sẵn |
| `P05-05` (phần Retailer) | Từ chối lô tới bằng `rejectTransfer` | Cùng màn Chờ nhận |
| `P04-15` | Retailer của lô đã nhận tải được hóa đơn riêng | Chưa có màn này; làm chung với Farmer (backend có sẵn `GET /documents/{id}/content`) |

## Dùng lại

- Cùng bộ công cụ với Logistics (xem `ROLE-LOGISTICS.md`, mục "Dùng lại"): `tx.ts`, `TxProgressModal`, `useStepFlow`, `chainLogs.ts`, `lib/hash.ts`, `documentsApi.ts` (upload), `roles.ts`.
- Mẫu upload + ghi chain: `features/farmer/pages/FarmerCreatePage.tsx` (upload → ghi → bind).
- Dữ liệu thử: `backend\scripts\seed_local.py` Retailer đang giữ COCONUT-001 (Sold), 002 (Delivered, bán được), 005 (Sold, đã thu hồi), 006 (Delivered, đã hết hạn); báo sự cố thử được trên cả bốn lô. Muốn thử nhận hàng thì Logistics phải gửi yêu cầu (luồng LD trong `TESTCASE.md`).

## Cách làm

1. Làm sau Logistics (cần lô Delivered), hoặc dùng lô seed sẵn để làm song song.
2. Bỏ fixtures, nối từng trang vào contract.
3. Kiểm tra theo Phần 3 của `TESTCASE.md` (mã `RT`) bằng MetaMask thật với ví #4: nhận lô (thử hash sai), bán hết, báo sự cố; sau đó vào trang trace xem timeline hiện đúng.
4. Khi chạy thật xong thì báo để tick mã trong `CODE.md`. Commit và PR nhắc mã việc.

## Xong khi

- Nhận lô chỉ khi 3 hash khớp; sai thì không có giao dịch.
- Bán hết chuyển lô sang Sold; gọi lại bị chặn.
- Báo sự cố có tx, hiện ở trang trace và trang Admin.
- Ví không phải Retailer không vào được màn này.
