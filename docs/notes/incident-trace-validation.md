# Bước 07 — kiểm chứng truy ngược và thu hồi

Ngày kiểm tra: 25/11/2026. Nhánh: `nguyen`. Chưa nghiệm thu browser/MetaMask hoặc Sepolia.

## Phạm vi và kết quả

`frontend/tests/incident-trace.integration.mjs` triển khai contract thật lên Hardhat riêng cổng 18545, rồi chạy reader Admin và Public từ source ứng dụng. Không dùng node dữ liệu người dùng cổng 8545. Gateway HTTP trong test phục vụ bytes fixture và mô phỏng lỗi; đây không phải lần kiểm tra Pinata thật.

| Lô | Nguồn gốc | Trạng thái trước thu hồi | Vai trò kiểm tra |
| --- | --- | --- | --- |
| COCONUT-001 | FARM-A / HG-A01 | Sold, owner Retailer | Lô báo sự cố |
| COCONUT-002 | FARM-A / HG-A01 | Delivered, owner Retailer | Cùng nhóm, cần Admin quyết định thu hồi riêng |
| COCONUT-003 | FARM-A / HG-A02 | InTransit | Đối chứng khác nhóm |
| COCONUT-004 | FARM-B / HG-B01 | Created | Đối chứng khác trang trại |

Sáu nhóm kiểm tra con đạt (Node test runner báo 7 tests kể cả test cha):

- Xác định creator từ event tạo lô, farm/group từ contract; phân loại đúng lô liên quan và hai nhóm đối chứng. Đủ năm readings 10/12/18/13/11°C và ba bản ghi ownership (mint + hai transfer).
- Đo năm lần đọc độc lập; số RPC bằng số JSON-RPC request proxy thực nhận.
- Khi RPC giới hạn khoảng `getLogs`, reader chia khoảng; số đếm gồm cả request lỗi và lần thử lại.
- Bytes báo cáo bị sửa thì hash mismatch và không dùng mô tả JSON làm nội dung đã đối chiếu. Gateway lỗi vẫn truy được nguồn gốc trên chain.
- Thu hồi 001 giữ Sold và owner Retailer; 002 không tự bị thu hồi. Sau lệnh riêng thu hồi 002, các lô 003/004 không bị thu hồi. Reader Public nhận đúng Sold + Recalled. Lý do thu hồi bị sửa hash không được dùng làm nội dung đã đối chiếu.
- Sự cố không tồn tại, sai mạng và request đã hủy trả lỗi tương ứng, không trả kết quả giả.

Nhiệt độ 18°C là vượt ngưỡng fixture 8–15°C, không phải bằng chứng kết luận nhiễm khuẩn. Phạm vi cùng nhóm là thông tin hỗ trợ quyết định, không tự động chứng minh mọi lô cùng nhóm có sự cố.

## Số đo local

| Lần | Truy ngược chain (ms) | Tải bằng chứng (ms) | Tổng (ms) | JSON-RPC request | Event giải mã |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 47 | 122 | 169 | 62 | 14 |
| 2 | 67 | 122 | 189 | 62 | 14 |
| 3 | 54 | 122 | 176 | 62 | 14 |
| 4 | 68 | 121 | 190 | 62 | 14 |
| 5 | 60 | 122 | 182 | 62 | 14 |

Trung vị chain 60 ms, tổng 182 ms. Gateway test được chủ động thêm 120 ms trễ để kiểm tra cách tách thời gian; số này không thể suy rộng thành tốc độ Internet/Pinata/Sepolia. Quy mô chỉ bốn lô trên máy local, chưa phải benchmark dữ liệu lớn. Tổng thời gian gồm cả tải bằng chứng; số event là event được reader giải mã, không phải số lô liên quan.

## Chạy lại

Khởi chạy một node Hardhat test riêng cổng 18545 với artifact đã compile từ source hiện tại. Trong `frontend`:

```sh
TRACE_TEST_RPC_URL=http://127.0.0.1:18545 node --test tests/incident-trace.integration.mjs
```

Có thể đặt `TRACE_TEST_ARTIFACT` nếu artifact nằm ngoài đường dẫn mặc định `contracts/artifacts/contracts/FoodTraceability.sol/FoodTraceability.json`. Test mặc định bỏ qua khi không có `TRACE_TEST_RPC_URL`; từ chối cổng 8545. Dừng node test sau khi kiểm tra.

Lint, typecheck và build chạy với Node 22.23.3, source/config/public và package-lock giống repository tại `/private/tmp/cocomark-frontend-verification` để tránh dependency iCloud dataless. Cả ba đạt; build còn cảnh báo chunk lớn hơn 500 kB.

## Còn nghiệm thu

- Bước 08: deployment và kiểm tra trên Sepolia; không dùng địa chỉ deploy local làm minh chứng testnet.
- Bước 09: Retailer gửi báo cáo trên giao diện, Admin xem kết quả/phạm vi và ký thu hồi, Public hiển thị cảnh báo; thử ví từ chối ký và kiểm tra responsive.
- Chưa tự đánh dấu các checklist nghiệm thu trong `docs/plan/CODE.md`.
