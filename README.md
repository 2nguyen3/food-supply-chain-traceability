# Food Supply Chain Traceability

> Hệ thống truy xuất nguồn gốc thực phẩm ứng dụng Blockchain  
> Đồ án môn IS355 – Công nghệ Blockchain  
> Trường Đại học Công nghệ Thông tin, ĐHQG-HCM

## Giới thiệu

Food Supply Chain Traceability là hệ thống theo dõi và truy xuất
nguồn gốc thực phẩm xuyên suốt quá trình từ nông trại, vận chuyển
đến nhà bán lẻ.

Dự án sử dụng **lô dừa nguyên trái** làm đối tượng quản lý. Mỗi lô cố định
**1 tấn (1.000 kg)** và được đại diện bởi **một NFT ERC-721**, gắn với
hồ sơ sản phẩm lưu trên IPFS. Các hoạt động tạo lô, bàn giao, vận chuyển
và thu hồi được ghi nhận trên blockchain để các bên có thể kiểm tra lịch
sử và đối chiếu giao dịch.

Người tiêu dùng truy cập trang tra cứu công khai bằng mã lô hoặc
QR để xem nguồn gốc, hành trình và cảnh báo liên quan mà không
cần kết nối ví.

## Mục tiêu

- Minh bạch nguồn gốc và quá trình lưu chuyển của từng lô thực phẩm.
- Kiểm soát quyền thao tác của các bên trong chuỗi cung ứng.
- Kiểm tra tính toàn vẹn của hồ sơ khi tiếp nhận lô hàng.
- Theo dõi điều kiện vận chuyển qua dữ liệu cảm biến giả lập.
- Hỗ trợ truy ngược nguồn gốc và xác định các lô liên quan khi có sự cố.
- Bảo vệ tài liệu riêng bằng mã hóa và phân quyền truy cập.

## Các bên tham gia

| Vai trò | Trách nhiệm |
|---|---|
| Admin | Quản lý vai trò, xem xét sự cố và ghi nhận quyết định thu hồi. |
| Farmer | Khởi tạo lô, cung cấp hồ sơ và đề nghị bàn giao cho đơn vị vận chuyển. |
| Logistics | Tiếp nhận lô, ghi nhận dữ liệu vận chuyển và bàn giao cho nhà bán lẻ. |
| Retailer | Kiểm tra hồ sơ, xác nhận nhận hàng, ghi nhận bán hết và báo cáo sự cố. |
| Consumer | Tra cứu thông tin công khai qua mã lô hoặc QR. |

## Tổng quan kiến trúc

Hệ thống gồm các thành phần:

| Thành phần | Vai trò trong hệ thống |
|---|---|
| Web DApp | Cung cấp giao diện nghiệp vụ và trang truy xuất công khai; kết nối ví để người dùng ký giao dịch. |
| Smart contract | Thực thi quy tắc nghiệp vụ, phân quyền, quản lý trạng thái lô và NFT trên Ethereum Sepolia. |
| Backend API | Xác thực chữ ký ví, xử lý tài liệu, mã hóa và kiểm soát quyền truy cập tài liệu riêng. |
| PostgreSQL | Lưu nonce, phiên đăng nhập, thông tin tài liệu riêng và quyền truy cập. |
| IPFS | Lưu chứng nhận, hình ảnh, metadata và nội dung tài liệu đã mã hóa. |
| IoT Simulator | Giả lập dữ liệu nhiệt độ, vị trí và gửi giao dịch bằng Python/Web3.py. |

Trang truy xuất công khai đọc dữ liệu trực tiếp từ blockchain
và IPFS. Lịch sử chuyển giao NFT được dựng từ các sự kiện
`Transfer`, không phụ thuộc vào cơ sở dữ liệu trung tâm.

Backend và PostgreSQL phục vụ xác thực cùng quản lý tài liệu
riêng. Chủ thể đang giữ lô và trạng thái nghiệp vụ được xác định
từ smart contract.

## Luồng nghiệp vụ

1. **Khởi tạo lô:** Farmer cung cấp thông tin thu hoạch và hồ sơ;
   hệ thống tạo NFT đại diện cho lô.
2. **Bàn giao vận chuyển:** Farmer đề nghị bàn giao; Logistics
   kiểm tra hồ sơ và xác nhận tiếp nhận.
3. **Theo dõi vận chuyển:** Logistics ghi nhận nhiệt độ, vị trí
   và thời điểm quan sát.
4. **Tiếp nhận tại nhà bán lẻ:** Retailer kiểm tra tính toàn vẹn
   của hồ sơ trước khi xác nhận nhận hàng.
5. **Tra cứu và bán lẻ:** Người tiêu dùng xem thông tin qua QR;
   Retailer ghi nhận khi toàn bộ lô đã bán hết.
6. **Xử lý sự cố:** Retailer báo cáo sự cố; hệ thống hỗ trợ
   truy ngược về trang trại và nhóm thu hoạch để Admin xem xét
   thu hồi các lô liên quan.

Việc bàn giao chỉ làm thay đổi chủ thể giữ NFT khi bên nhận
xác nhận thành công.

## Hồ sơ và tính toàn vẹn dữ liệu

Hồ sơ công khai gồm chứng nhận PDF mẫu, ảnh lô hàng và metadata
JSON. NFT tham chiếu metadata thông qua URI dạng `ipfs://CID`.

Khi tiếp nhận, ứng dụng tải hồ sơ và tính SHA-256 trên nội dung
file. Smart contract đối chiếu các hash được gửi với giá trị
đã ghi nhận trước khi hoàn tất bàn giao.

Tài liệu riêng, chẳng hạn hóa đơn giá mua sỉ, được mã hóa bằng
AES-256-GCM trước khi đưa lên IPFS. Quyền đọc được kiểm tra
theo ví, vai trò và quyền trên từng tài liệu.

## Phạm vi dự án

- Quản lý nguyên lô dừa nguyên trái, mỗi lô 1.000 kg tương ứng một NFT.
- Mô phỏng chuỗi Farmer → Logistics → Retailer.
- Sử dụng dữ liệu và chứng nhận mẫu phục vụ học tập.
- Giả lập cảm biến; chưa tích hợp thiết bị IoT thực tế.
- Chưa triển khai chia/gộp lô, thanh toán hoặc thị trường NFT.

Dữ liệu blockchain hỗ trợ kiểm tra lịch sử ghi nhận và người ký.
Chất lượng thực phẩm thực tế vẫn cần quy trình kiểm định
ngoài hệ thống.

## Thành viên thực hiện

| STT | Họ và tên | MSSV | Vai trò trong nhóm |
|:---:|---|:---:|---|
| 1 | Nguyễn Trần Thảo Nguyên | 23521052 | Nhóm trưởng |
| 2 | Nguyễn Thuý Ngân | 23520996 | Thành viên |
| 3 | Lê Đào Anh Thư | 23521537 | Thành viên |
| 4 | Trần Ngọc Quỳnh Hoa | 23520507 | Thành viên |

## Giảng viên hướng dẫn

**ThS. Hà Lê Hoài Trung**
