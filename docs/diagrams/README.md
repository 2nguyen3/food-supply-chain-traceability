# Sơ đồ (draw.io)

Mở bằng extension draw.io trong VS Code. Mỗi file có nhiều page (thanh tab ở cuối cửa sổ). Chỉ dùng trắng và đen.
Ảnh xuất cho báo cáo (PNG/SVG) để ở `export/`.

| File | Page | Nội dung | Nguồn trong KeHoach |
|---|---|---|---|
| 01-architecture | Kiến trúc tổng thể | DApp, contract, backend, Postgres, IPFS, IoT | mục 4 |
| | Triển khai | hosting, PaaS, Sepolia, máy dev | mục 24 |
| | Dữ liệu lưu ở đâu | on-chain / IPFS / PostgreSQL | mục 4.2 |
| 02-nghiep-vu | Quy trình nghiệp vụ | trồng trọt → người tiêu dùng, CTE, nhánh sự cố | mục 15.3, Hình 1 |
| | Vòng đời lô hàng | lifecycle + cờ recalled + expired suy ra | mục 5, 15.1 |
| | Use case | theo vai trò, gắn F01–F10 | mục 15.1 |
| 03-sequence | Bàn giao hai bước | request / accept có xác minh 3 hash | mục 11 |
| | Đăng nhập bằng chữ ký ví | nonce, chống phát lại | mục 19 |
| | Tạo lô | upload hồ sơ → createBatch → bind | mục 8, 15.2, 17 |
| | Sự cố và thu hồi | báo sự cố → truy ngược → recall | mục 23 |
| | IoT simulator | simulate.py ghi nhiệt độ lên chain | mục 22 |
| 04-data-model | ERD PostgreSQL | 4 bảng, FK thật và liên hệ logic qua ví | mục 15.1 |
| | Cấu trúc contract | mỗi vai trò làm được gì, dữ liệu lưu trong contract | mục 8–10 |
| 05-wireframes | Wireframe | 5 màn hình; viền đậm = ghi chain, nét đứt = gọi API, chấm = đọc RPC/IPFS | mục 15.1, 20 |
| | Liên kết màn hình | bản đồ điều hướng giữa các màn: công khai, đăng nhập, 4 vai trò (theo tuyến của ứng dụng) | mục 15.1, 20 |

## Lưu ý
- Các file được sinh bằng script trong `_src/` (`python -I _src/build.py <thư mục docs/diagrams> <thư mục ảnh xem trước>`), cả 5 file đều khớp đúng script (kiểm ngày 08/11/2026). Sửa ở script rồi sinh lại; nếu bạn chỉnh tay trong draw.io thì đừng sinh lại vì sẽ ghi đè. Ảnh xem trước cần `matplotlib`; không có thì bỏ qua ảnh, file `.drawio` vẫn được sinh và vẫn kiểm lỗi bố cục.
- Cỡ chữ: tiêu đề 22, nội dung 15, nhãn và ghi chú 14 (đã tăng ngày 08/11/2026 cho dễ đọc).
- Đã cập nhật 08/11/2026 cho khớp hệ thống thực tế: thông điệp đăng nhập do backend dựng lại, DApp đọc vai trò bằng `hasRole`, phiên lưu ở `sessionStorage` (sống qua F5), đăng xuất; tên trường `token_id`, `tx_hash` khi bind; ERD khớp migration 0002.
- Chỗ KeHoach chưa nói rõ đã ghi chú ngay trong sơ đồ (đã chốt xong thì ghi "đã chốt" kèm ngày).
- Kiểu cột trong ERD khớp migration 0002; custom error trong contract là đề xuất, chưa chốt.
- ERD: nét liền là khóa ngoại thật; nét đứt là liên hệ logic qua địa chỉ ví (không có bảng tài khoản nên không có FK).
