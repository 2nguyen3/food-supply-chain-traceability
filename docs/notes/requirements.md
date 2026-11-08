# Yêu cầu

Tóm tắt từ KeHoach mục 1, 5, 6. Khi lệch nhau, KeHoach là chuẩn.

## Phạm vi
- Quản lý nguyên lô dừa: 1 lô = 1.000 kg (`quantityKg = 1000`) = 1 NFT. Không chia/gộp lô.
- Không thanh toán, marketplace, phần cứng IoT thật.
- Consumer đọc trang công khai qua HTTPS, không cần ví.

**Cắt trước nếu thiếu thời gian:** hết hạn yêu cầu bàn giao, thay ví đang giữ lô, khôi phục vai trò, bọc khóa RSA/ECIES.
**Điểm mở rộng thực sự:** bàn giao hai bên, thu hồi lô Sold, quyền từng tài liệu, đăng nhập chống phát lại.

## Vai trò
| Vai trò | Phạm vi |
|---|---|
| Admin | Cấp/thu hồi vai trò, gán farmId, xét sự cố, thu hồi lô có lý do. Không mặc nhiên đọc được hóa đơn. |
| Farmer | Tạo lô thuộc farmId được gán; tạo hồ sơ; đề nghị giao Logistics. |
| Logistics | Nhận lô được chỉ định; ghi cảm biến khi đang giữ; đề nghị giao Retailer. |
| Retailer | Kiểm hồ sơ, nhận lô; bán hết; báo sự cố (kể cả sau Sold). |
| Consumer | Tra cứu công khai, xem chứng chỉ và ảnh từ IPFS. |

## Chức năng
| Mã | Nội dung |
|---|---|
| F01 | Vai trò và farmId; cấp/thu hồi có event |
| F02 | Tạo lô + mint NFT + tokenURI trong cùng giao dịch |
| F03 | request / accept / reject / cancel bàn giao |
| F04 | Ghi vận chuyển: nhiệt độ, thời gian, vị trí |
| F05 | Bán hết sau Delivered |
| F06 | Tra cứu QR; timeline + ownership history kèm txHash, link Etherscan |
| F07 | PDF/ảnh/JSON; mã hóa và ACL tài liệu riêng |
| F08 | Phát hiện vượt ngưỡng nhiệt độ (đồ thị là nâng cao) |
| F09 | Truy về farm/nhóm thu hoạch; đề xuất lô liên quan; thu hồi |
| F10 | Retailer ghi sự cố kèm bằng chứng IPFS |

## Ánh xạ hàm của đề
| Đề | Dự án |
|---|---|
| harvestProduct | createBatch |
| updateTransitStatus | recordTransit |
| receiveAndVerify | acceptTransfer (nhánh Retailer, so 3 hash rồi mới Delivered) |

## Quy tắc nghiệp vụ (BR)
| Mã | Quy tắc |
|---|---|
| BR01/BR02 | Chỉ FARMER_ROLE; farmId từ mapping Admin; mã lô duy nhất; `quantityKg == 1000`; `harvestDate ≤ now < expiryDate` |
| BR03/BR04 | Một mã lô/một NFT; tuyến chỉ Farmer→Logistics→Retailer; kiểm vai trò cả hai bên tại accept |
| BR05 | Chặn request/accept/recordTransit/markSold khi Sold/expired/recalled; reject/cancel vẫn được |
| BR06 | recordTransit: Logistics đang giữ, InTransit; readingId chưa dùng; observedAt ≤ now và không lùi |
| BR07 | Thu hồi có lý do + incidentId hợp lệ + event; không xóa provenance; được phép sau Sold/hết hạn |
| BR08 | Chỉ đổi chủ khi đúng đủ 3 hash; sai một hash thì revert |

## Dữ liệu demo
| Lô | Farm / nhóm | Vai trò |
|---|---|---|
| COCONUT-001 | FARM-A / HG-A01 | Retailer phát hiện sự cố; có reading bất thường |
| COCONUT-002 | FARM-A / HG-A01 | Lô liên quan, thu hồi kể cả khi Sold |
| COCONUT-003 | FARM-A / HG-A02 | Đối chứng khác nhóm thu hoạch |
| COCONUT-004 | FARM-B / HG-B01 | Đối chứng khác trang trại |

Ví demo (testnet): Admin, Farmer A, Farmer B, Logistics, Retailer.
Ngưỡng nhiệt minh họa 8–15°C; 5 readings: 10, 12, 18, 13, 11°C (18°C cảnh báo).
