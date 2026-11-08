# Kiểm thử thủ công theo vai trò

Phần 1: Farmer. Phần 2: Logistics. Phần 3: Retailer. Phần 4: Admin.

Danh sách để bạn tự thử bằng MetaMask thật. Thử xong mục nào đạt thì tự tick `[x]`.

Phạm vi của Phần 1: luồng Farmer (P03-21, P04-11, P04-13, P04-14, P04-15, P05-04, P05-05). Phần đăng nhập, kết nối ví và đăng xuất đã kiểm xong, không nằm trong file này. Phần 2 đến 4 dùng cho các vai trò còn lại, kiểm khi trang đã nối dữ liệu thật.

## Các luồng của Farmer cần kiểm

| Luồng                                            | Mục đích                                                                     | Mã mục      | Làm sau luồng nào           |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- | ------------------------------ |
| **A. Xem tổng quan và danh sách lô**    | Dữ liệu Farmer đọc thật từ hợp đồng                                    | F01 đến F08 | không (làm đầu tiên)      |
| **B. Xem chi tiết lô**                    | Hồ sơ, nhiệt độ, hành trình, QR của một lô                            | F09 đến F19 | A                              |
| **C. Tạo lô mới**                        | Nhập dữ liệu, tải hồ sơ lên IPFS, ký `createBatch`, nhận biên nhận | C01 đến C26 | A                              |
| **D. Bàn giao cho Logistics**              | `requestTransfer`, `cancelTransfer`, lịch sử                              | T01 đến T11 | C (cần lô mới do bạn tạo) |
| **E. Cách ly dữ liệu giữa hai Farmer**  | Farmer B không thấy dữ liệu của Farmer A                                   | I01 đến I03 | C                              |
| **F. Kiểm tra chéo trang công khai**     | Lô vừa tạo xem được không cần ví                                       | P01 đến P03 | C                              |
| **G. Giữ phiên khi tải lại trang (F5)** | Vẫn đăng nhập sau F5, và các trường hợp không được khôi phục     | S01 đến S08 | không                         |
| **H. Tài liệu riêng của lô**           | Tải hóa đơn, cấp và thu hồi quyền đọc (P04-15)                              | H01 đến H12 | C (lô có hóa đơn riêng)        |

Thứ tự nên làm: A, B, C, D, E, F, H. Luồng G (giữ phiên khi F5) làm lúc nào cũng được. Các luồng đăng nhập bằng **Farmer A** trừ luồng E (Farmer B) và mục C25, C26.

---

## 0. Chuẩn bị

### 0.1 Cài MetaMask và nhập tài khoản

- [X] **E01** Cài extension MetaMask từ trang chính thức `metamask.io/download`, tạo ví mới với mật khẩu do bạn tự đặt, chép 12 từ khôi phục ra giấy.
- [X] **E02** Nhập các tài khoản Hardhat vào MetaMask (Thêm tài khoản, Nhập khóa riêng). Khóa riêng lấy trong log của `npx hardhat node` (dòng `Account #n … Private Key`). Khóa này công khai, chỉ dùng cho local, không gửi tiền thật vào.

| Tài khoản Hardhat | Đặt tên trong MetaMask | Địa chỉ (rút gọn) | Vai trò trong dữ liệu seed |
| ------------------- | ------------------------- | ---------------------- | ----------------------------- |
| #0                  | Admin                     | `0xf39F…2266`       | Admin                         |
| #1                  | Farmer A                  | `0x7099…79C8`       | Farmer, farmId `FARM-A`     |
| #2                  | Farmer B                  | `0x3C44…93BC`       | Farmer, farmId `FARM-B`     |
| #3                  | Logistics                 | `0x90F7…b906`       | Logistics                     |
| #4                  | Retailer                  | `0x15d3…6A65`       | Retailer                      |
| #5                  | Chưa quyền              | `0x1Bc29…b7705`     | không có vai trò           |

- [X] **E03** Mỗi tài khoản đã nhập hiện đúng địa chỉ rút gọn như bảng trên.

### 0.2 Bật hệ thống

Dựng lại chain mới cho sạch: tắt Hardhat node cũ, bật lại, rồi seed. Chi tiết lệnh ở mục 9 và 10 của `docs/environment.md`.

- [ ] **E04** Docker Desktop bật, database `food-traceability-db` ở trạng thái `healthy`.
- [ ] **E05** Hardhat node chạy ở cổng 8545 (node mới).
- [ ] **E06** Đã chạy `seed_local.py` xong (script chờ khoảng 1 phút cho lô 006 hết hạn). Có 6 lô COCONUT-001 đến 006.
- [ ] **E07** Backend chạy với biến môi trường ghi đè cho chain local (`RPC_URL`, `CHAIN_ID=31337`, `CONTRACT_ADDRESS`, `DEPLOY_BLOCK`, `AUTH_DOMAIN=127.0.0.1:5173`), mở `http://127.0.0.1:8000/health` thấy `{"status":"ok"}`.
- [ ] **E08** Frontend chạy, mở `http://127.0.0.1:5173` (đúng địa chỉ này, không dùng `localhost`).
- [X] **E09** Vì vừa dựng lại node: trong MetaMask, mỗi tài khoản vào Cài đặt, Công cụ dành cho dev, **Xóa dữ liệu hoạt động và số nonce** (nếu không sẽ báo sai nonce khi gửi giao dịch).

---

## Luồng A. Xem tổng quan và danh sách lô (đăng nhập **Farmer A**)

Nếu bạn dựng chain mới thì Farmer A có đúng 3 lô: COCONUT-001, 002, 003 (đều đã chuyển cho người khác).

- [X] **F01** `/farmer/overview`: lời chào "Xin chào, Farmer · 0x7099…79C8", dòng "Trang trại FARM-A".
- [X] **F02** 4 thẻ số liệu: Lô đã tạo = 3, Đang sở hữu = 0, Chờ bàn giao = 0, Đã chuyển giao = 3.
- [X] **F03** "Lô gần đây" hiện các lô, ảnh dừa của từng lô tải từ IPFS (có thể chậm vài giây), nhãn trạng thái đúng (001 Sold, 002 Delivered, 003 InTransit).
- [X] **F04** "Bàn giao gần đây" hiện 3 yêu cầu trạng thái "Đã nhận" kèm thời gian.
- [X] **F05** `/farmer/batches`: bảng có đủ cột (Mã lô, Token, Farm/Nhóm, Chủ sở hữu NFT, Trạng thái, Hạn dùng). Chủ sở hữu của 001 là Retailer, 002 là Retailer hoặc Logistics tuỳ seed, 003 là Logistics, mỗi dòng ghi "Đã chuyển quyền sở hữu".
- [X] **F06** Ô tìm theo mã lô: gõ `002` chỉ còn lô 002.
- [X] **F07** Lọc trạng thái: chọn "Sold" chỉ còn lô 001; chọn "Hết hạn" và "Đã thu hồi" không có lô của Farmer A (đúng).
- [X] **F08** Ô "Mở lô theo mã": gõ `COCONUT-001` rồi Mở thì vào trang chi tiết; gõ mã không phải của bạn (ví dụ `COCONUT-004`) thì báo "Không tìm thấy mã lô trong các lô bạn đã tạo."

---

## Luồng B. Xem chi tiết lô (mở COCONUT-001)

- [X] **F09** Đầu trang: tên lô, "tokenId #1 · FARM-A / HG-A01", huy hiệu trạng thái "Sold · Đã bán". Thanh vòng đời 4 bước đều đã đạt.
- [X] **F10** Tab **Tổng quan**: đủ trường (tokenId, batchCode, farmId, vị trí, ngày thu hoạch, hạn sử dụng, giống, phân bón, nhiệt độ min/max, chủ sở hữu NFT là địa chỉ ví đầy đủ, metadata URI).
- [X] **F11** Nút "Yêu cầu chuyển cho Logistics" bị khóa kèm lý do "Bạn không phải chủ sở hữu NFT hiện tại."
- [X] **F12** Bấm "Mở trang công khai" mở đúng trang `/trace/31337/…/1` của lô.
- [X] **F13** Tab **Tài liệu công khai**: 3 thẻ (metadata.json, certificate.pdf, batch.jpg), mỗi thẻ có CID, `ipfs://CID`, SHA-256 và dòng "SHA-256 của tệp tải về KHỚP hash trên blockchain."
- [X] **F14** Nút "Xem bản gốc" mở được chứng chỉ PDF và ảnh ở tab mới; "Tải tệp" tải được tệp.
- [X] **F15** Tab **Nhiệt độ**: biểu đồ có 5 điểm, 1 điểm đỏ (18°C), vùng ngưỡng 8 đến 15°C, bảng bên dưới đủ 5 dòng có giờ block và txHash.
- [X] **F16** Tab **Hành trình & NFT**: dòng thời gian đủ sự kiện (tạo lô, bàn giao, nhiệt độ, đã bán) và "Lịch sử sở hữu ERC-721" có Farmer, Logistics, Retailer.
- [X] **F17** Tab **QR**: mã QR, nút "Sao chép liên kết" và "Tải mã QR" hoạt động; quét QR bằng điện thoại hoặc dán liên kết vào `/trace` mở đúng lô.
- [ ] **F18** Tab **Tài liệu riêng** của lô 001 (không có hóa đơn): báo "Lô này chưa có hóa đơn riêng". Chi tiết tab này kiểm ở luồng H.
- [X] **F19** Gõ tay `/farmer/batches/COCONUT-004` (lô của Farmer B): báo "Không tìm thấy lô", không xem được dữ liệu của người khác.

---

## Luồng C. Tạo lô mới (P04-13, P04-14, P05-04)

Chuẩn bị 2 tệp thật: một PDF (bạn có thể dùng `backend/scripts/sample_data/certificate.pdf`) và một ảnh JPG hoặc PNG (ví dụ `frontend/public/images/home/coconut-cluster.jpg`).

### C.1 Bước 1: dữ liệu lô

- [ ] **C01** `/farmer/create`: ô Farm ID tự điền `FARM-A` (không sửa được). Ô khối lượng ghi cố định "1.000 kg · 1 NFT".
- [ ] **C02** Bấm Tiếp tục khi để trống: báo lỗi từng ô bắt buộc, ở lại bước 1.
- [ ] **C03** Nhập mã lô có chữ thường (ví dụ `coconut-001`): hệ thống đổi sang chữ in hoa khi kiểm tra; do `COCONUT-001` đã có trên blockchain nên báo **"Mã lô đã tồn tại trên blockchain."**
- [ ] **C04** Nhập mã chứa ký tự lạ (ví dụ `abc_1`): báo "Mã lô chỉ gồm chữ in hoa, số và dấu gạch nối."
- [ ] **C05** Ngày thu hoạch ở tương lai: báo lỗi. Hạn sử dụng trước hoặc bằng ngày thu hoạch, hoặc không sau hôm nay: báo lỗi. Nhiệt độ tối đa nhỏ hơn tối thiểu: báo lỗi.
- [ ] **C06** Nhập đủ dữ liệu hợp lệ với mã mới (ví dụ `COCONUT-007`): sang bước 2.

### C.2 Bước 2: tệp công khai (tải lên IPFS)

- [ ] **C07** Bấm Tiếp tục khi chưa chọn tệp: báo "Cần chọn PDF chứng chỉ." và "Cần chọn ảnh gốc của lô."
- [ ] **C08** Chọn một tệp không phải PDF vào ô chứng chỉ (ví dụ đổi đuôi `.txt` thành `.pdf`): báo "Chỉ chấp nhận tệp PDF hợp lệ." (kiểm theo nội dung, không theo đuôi).
- [ ] **C09** Chọn ảnh WebP hoặc GIF vào ô ảnh: báo "Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG hợp lệ."
- [ ] **C10** Chọn đúng PDF và ảnh: hiện tên, dung lượng, loại tệp, SHA-256 tính từ byte tệp, và xem trước ảnh.
- [ ] **C11** Bấm Tiếp tục: hiện lần lượt "Đang tải chứng chỉ lên IPFS…", "Đang tải ảnh lô lên IPFS…", "Đang tạo và tải metadata.json lên IPFS…", rồi sang bước 3.

### C.3 Bước 3: metadata và hóa đơn

- [ ] **C12** 3 thẻ hồ sơ (certificate, ảnh, metadata.json) đều có **CID thật** và SHA-256.
- [ ] **C13** Mở "Xem nội dung metadata.json": có `image` và `certificateURI` dạng `ipfs://…`, `certificateSHA256`, `imageSHA256`, `farmId` đúng `FARM-A`, `quantityKg` là 1000, `schemaVersion` là 1, `tempMin`, `tempMax` đúng số đã nhập.
- [ ] **C14** (Tùy chọn) Chọn một PDF làm hóa đơn riêng, bấm Tiếp tục: có thông báo "Đang mã hóa và tải hóa đơn riêng…" rồi sang bước 4.
- [ ] **C15** Bấm Quay lại, đổi một ô ở bước 1 rồi đi tiếp: hệ thống tạo lại metadata (CID mới), không dùng metadata cũ.

### C.4 Bước 4: xem lại và ký

- [ ] **C16** Danh sách điều kiện đều có dấu tích xanh (Vai trò Farmer, farmId, Đúng mạng, Khối lượng, Ba hồ sơ công khai, Mã lô chưa dùng). Không có dấu `!`.
- [ ] **C17** Bấm "Ký và gửi createBatch": hiện khung tiến trình 5 bước (Kiểm tra điều kiện, Chờ ký ví, Phát giao dịch, Chờ biên nhận, Gắn hồ sơ), MetaMask hiện hộp xác nhận giao dịch.
- [ ] **C18** **Từ chối** giao dịch trong MetaMask: khung báo "Bạn đã từ chối ký", lô **chưa được tạo** (vào `/trace?q=COCONUT-007` thì báo không tìm thấy). Bấm "Ký lại" chạy lại được.
- [ ] **C19** Xác nhận giao dịch: các bước chạy hết, hiện txHash, thông báo "Đã mint NFT #… và gắn hồ sơ vào lô."

### C.5 Bước 5: biên nhận và kiểm tra sau khi tạo

- [ ] **C20** Bấm Hoàn tất: sang bước 5 "Biên nhận" với banner "Đã tạo lô thành công", Token ID, tokenURI `ipfs://…`, txHash, và mã QR.
- [ ] **C21** Mã QR và liên kết trỏ đúng `/trace/31337/<contract>/<tokenId>`; mở ra thấy lô mới với trạng thái "Created", ảnh và 3 hồ sơ **khớp SHA-256**.
- [ ] **C22** Bấm "Xem chi tiết lô": vào trang chi tiết của lô mới, trạng thái Created, chủ sở hữu là ví Farmer A.
- [ ] **C23** Vào lại Tổng quan: "Lô đã tạo" tăng thêm 1, "Đang sở hữu" tăng thêm 1. Lô mới nằm đầu "Lô gần đây".
- [ ] **C24** Tạo lô thứ hai ngay sau đó (mã khác): vẫn chạy được, tokenId tăng tiếp.

### C.6 Tạo lô bằng ví khác

- [ ] **C25** Tạo lô bằng **Farmer B**: ô Farm ID ghi `FARM-B`, `metadata.json` có `farmId` `FARM-B`.
- [ ] **C26** Tạo lô bằng ví không phải Farmer (ví dụ Logistics): vào `/farmer/create` không được (bị chặn quyền).

---

## Luồng D. Bàn giao cho Logistics (P05-05)

Dùng lô vừa tạo ở luồng C (ví dụ COCONUT-007), đăng nhập Farmer A.

- [ ] **T01** `/farmer/transfers`: mục "Lô có thể chuyển" chỉ hiện lô còn thuộc bạn, trạng thái Created, chưa hết hạn, chưa thu hồi. Lô 001 đến 003 không có trong danh sách.
- [ ] **T02** Bấm "Yêu cầu chuyển cho Logistics" ở lô mới: hộp chọn người nhận hiện danh sách ví Logistics đọc từ hợp đồng (có ví `0x90F7…b906`).
- [ ] **T03** Chưa chọn người nhận thì nút "Gửi yêu cầu" bị khóa. Chọn Logistics xong thì bấm được.
- [ ] **T04** Bấm "Gửi yêu cầu", MetaMask xác nhận giao dịch, khung tiến trình chạy, báo "Đã tạo yêu cầu bàn giao đang chờ…"
- [ ] **T05** Mục "Yêu cầu đang chờ" hiện yêu cầu mới (Request #n, người nhận Logistics, nhãn "Đang chờ"). Lô đó biến mất khỏi "Lô có thể chuyển". Tổng quan: "Chờ bàn giao" = 1.
- [ ] **T06** Chủ sở hữu NFT của lô **vẫn là Farmer A** (kiểm ở `/farmer/batches`).
- [ ] **T07** **Từ chối** giao dịch yêu cầu bàn giao trong MetaMask: khung báo "Bạn đã từ chối ký", không có yêu cầu nào được tạo.
- [ ] **T08** Bấm "Hủy yêu cầu (cancelTransfer)", xác nhận trong MetaMask: yêu cầu chuyển sang trạng thái "Đã hủy" trong "Lịch sử yêu cầu", lô quay lại "Lô có thể chuyển".
- [ ] **T09** Gửi lại yêu cầu lần nữa sau khi hủy: được (lô được phép tạo yêu cầu mới).
- [ ] **T10** "Lịch sử yêu cầu" có đủ cột (Request ID, Lô, Người nhận, Trạng thái, Tạo lúc, Đóng lúc); yêu cầu cũ của 001 đến 003 hiện "Đã nhận"; thời gian là giờ block, không phải giờ trình duyệt.
- [ ] **T11** Bấm nút sao chép địa chỉ ví người nhận: dán ra đúng địa chỉ.

---

## Luồng E. Cách ly dữ liệu giữa hai Farmer (đăng nhập **Farmer B**)

- [ ] **I01** `/farmer/batches` chỉ có lô 004, 005, 006 (và lô Farmer B vừa tạo ở C25), không có lô của Farmer A.
- [ ] **I02** Gõ tay `/farmer/batches/COCONUT-001`: báo "Không tìm thấy lô".
- [ ] **I03** `/farmer/transfers` chỉ thấy lô 004 (Created) là có thể chuyển. Lô 005 (đã thu hồi) và 006 (hết hạn) không có trong danh sách.

---

## Luồng F. Kiểm tra chéo với trang công khai

- [ ] **P01** Lô vừa tạo tra được bằng mã (`/trace?q=COCONUT-007`) và bằng token ID.
- [ ] **P02** Dán liên kết trong QR vào ô tìm kiếm: mở đúng lô.
- [ ] **P03** Trang công khai không cần ví: đăng xuất rồi mở lại vẫn xem được lô.

---

## Luồng G. Giữ phiên khi tải lại trang (F5)

Phiên được lưu trong `sessionStorage` của tab: sống qua F5, mất khi đóng tab.

- [ ] **S01** Đăng nhập Farmer A, ở `/farmer/overview` bấm **F5**: vẫn ở dashboard, thoáng hiện "Đang khôi phục phiên đăng nhập…" rồi hiện đủ dữ liệu, không bị đưa về `/connect`, không phải ký lại.
- [ ] **S02** F5 khi đang ở một trang sâu (ví dụ `/farmer/batches`, hoặc chi tiết một lô): vẫn đăng nhập và ở đúng trang đó.
- [ ] **S03** Sau F5 thanh trên cùng vẫn đúng: nhãn "Farmer", chip ví, huy hiệu mạng "Hardhat (local) · 31337"; chuyển trang trong ứng dụng vẫn bình thường.
- [ ] **S04** Bấm **Đăng xuất** rồi F5: vẫn ở `/connect`, không tự đăng nhập lại; gõ tay `/farmer/overview` thì về `/connect`.
- [ ] **S05** Đang đăng nhập bằng Farmer A, **đổi sang tài khoản khác trong MetaMask rồi F5**: không khôi phục, về `/connect`.
- [ ] **S06** Mở **tab mới** cùng địa chỉ: tab mới **không** tự đăng nhập (mỗi tab một phiên), phải kết nối và ký.
- [ ] **S07** Đóng tab rồi mở lại `http://127.0.0.1:5173/farmer/overview`: không còn đăng nhập (phiên mất khi đóng tab).
- [ ] **S08** (Cần dựng lại backend, làm nếu muốn) Đăng nhập, tắt rồi bật lại backend sao cho cơ sở dữ liệu phiên mất, F5, rồi thử tải hồ sơ ở trang Tạo lô: bị đưa về `/connect` kèm thông báo "Phiên đăng nhập đã hết hạn hoặc bị thu hồi…".

---

## Luồng H. Tài liệu riêng của lô (P04-15)

Dùng một lô có hóa đơn riêng: tạo lô mới ở luồng C, bước 3 chọn một PDF làm hóa đơn (mục C14). Đăng nhập **Farmer A**. Lô 001 đến 006 trong dữ liệu seed không có hóa đơn riêng.

- [ ] **H01** Mở chi tiết lô vừa tạo, tab **Tài liệu riêng**: hiện thẻ "Hóa đơn bán buôn" kèm dung lượng, giờ tải lên, SHA-256 của bản rõ và CID (CID chỉ trỏ tới dữ liệu đã mã hóa).
- [ ] **H02** Chưa cấp quyền cho ai: hiện "Chưa cấp quyền cho ví nào".
- [ ] **H03** Bấm "Tải hóa đơn": tệp tải về, mở được như PDF gốc, và có thông báo "SHA-256 của tệp đã giải mã KHỚP với hash đã lưu".
- [ ] **H04** Ô "Cấp quyền đọc cho" liệt kê ví Logistics và Retailer đọc từ hợp đồng (không có Farmer, Admin).
- [ ] **H05** Chọn ví Logistics rồi bấm "Cấp quyền": hiện "Đã cấp quyền đọc", ví đó xuất hiện trong danh sách kèm giờ được cấp, và biến khỏi ô chọn.
- [ ] **H06** Cấp thêm cho ví Retailer: cả hai ví cùng có quyền.
- [ ] **H07** Bấm "Thu hồi" ở ví Logistics: hiện "Đã thu hồi quyền đọc", dòng đổi thành "Đã thu hồi" kèm giờ; ví đó quay lại ô chọn và cấp lại được.
- [ ] **H08** Đăng nhập **Farmer B**, mở tay `/farmer/batches/<mã lô của Farmer A>`: báo không tìm thấy lô, không thấy hóa đơn.
- [ ] **H09** (Cần backend, kiểm bằng `curl` hoặc Postman với token của ví tương ứng) `GET /documents?token_id=<tokenId>`: Farmer A thấy hóa đơn kèm `can_manage = true` và danh sách grant; Logistics được cấp quyền thấy hóa đơn với `can_manage = false`; Admin nhận 403; Farmer B nhận danh sách rỗng; không có `wrapped_key` hay `aad` trong phản hồi.
- [ ] **H10** (Cần backend) Logistics bị thu hồi quyền ở H07 gọi lại `GET /documents/<id>/content`: 403 `ACCESS_DENIED`; trước khi thu hồi thì tải được.
- [ ] **H11** Lô 001 (không có hóa đơn riêng): tab **Tài liệu riêng** báo "Lô này chưa có hóa đơn riêng".
- [ ] **H12** Tắt backend rồi mở lại tab: báo lỗi "Không thể đọc danh sách tài liệu" kèm nút Thử lại; bật backend và bấm Thử lại thì hiện bình thường.

---

# Phần 2. Kiểm thử vai trò Logistics

Tiêu chí kiểm khi người nhận vai trò đã nối trang với contract. Dùng ví **Logistics** (#3, `0x90F7…b906`). Mã mục: `LG`.

Trạng thái lô trong dữ liệu seed lúc dựng chain mới:

| Lô | Trạng thái | Đang do ai giữ |
| --- | --- | --- |
| COCONUT-001 | Sold | Retailer |
| COCONUT-002 | Delivered | Retailer |
| COCONUT-003 | InTransit, đã có 5 bản nhiệt độ (readingId 1 đến 5) | **Logistics** |
| COCONUT-004 | Created (Farmer B) | Farmer B |
| COCONUT-005 | Sold, đã thu hồi | Retailer |
| COCONUT-006 | Delivered, đã hết hạn | Retailer |

## Các luồng của Logistics cần kiểm

| Luồng | Mục đích | Mã mục | Làm sau luồng nào |
| --- | --- | --- | --- |
| **LA. Tổng quan và lô đang giữ** | Dữ liệu đọc thật từ hợp đồng | LG01 đến LG06 | không |
| **LB. Nhận hàng từ Farmer** | Xác minh 3 hash rồi `acceptTransfer`, hoặc từ chối | LG07 đến LG17 | luồng D của Farmer (cần lô COCONUT-007 đang chờ) |
| **LC. Ghi nhiệt độ** | `recordTransit`, cảnh báo ngưỡng | LG18 đến LG26 | LA |
| **LD. Bàn giao cho Retailer** | `requestTransfer`, `cancelTransfer`, lịch sử | LG27 đến LG34 | LB |
| **LE. Quyền và cách ly** | Vai trò khác không vào được, không thấy lô người khác | LG35 đến LG38 | không |

### Luồng LA. Tổng quan và lô đang giữ

- [ ] **LG01** Đăng nhập ví Logistics vào `/logistics/overview`: lời chào đúng địa chỉ ví, không còn số liệu mẫu.
- [ ] **LG02** Thẻ số liệu khớp contract: "Đang giữ" = 1 (COCONUT-003) nếu chưa nhận lô nào; "Chờ nhận" bằng số yêu cầu đang chờ gửi tới ví này.
- [ ] **LG03** `/logistics/batches` chỉ có COCONUT-003; không có 001, 002, 004, 005, 006.
- [ ] **LG04** Mở COCONUT-003: trạng thái InTransit, chủ sở hữu NFT là địa chỉ ví Logistics, hồ sơ công khai hiện đủ 3 thẻ và hash khớp.
- [ ] **LG05** Tab nhiệt độ: biểu đồ 5 điểm, 1 điểm đỏ (18°C), vùng ngưỡng 8 đến 15°C, bảng 5 dòng có giờ block và txHash.
- [ ] **LG06** Mở trang công khai của lô từ nút trên trang chi tiết: đúng lô.

### Luồng LB. Nhận hàng từ Farmer

Điều kiện: ở luồng D của Farmer đã gửi yêu cầu bàn giao COCONUT-007 cho Logistics, và gửi thêm lô COCONUT-008 (dùng cho ca từ chối).

- [ ] **LG07** `/logistics/incoming` hiện yêu cầu của COCONUT-007: Request ID, bên gửi Farmer A, thời gian theo giờ block.
- [ ] **LG08** Mở yêu cầu: hệ thống lần lượt tải metadata.json, certificate.pdf, batch.jpg từ IPFS, tính SHA-256 và so với 3 hash lưu trên chain; hiện kết quả từng tệp.
- [ ] **LG09** Cả 3 tệp khớp: nút "Nhận lô" bấm được.
- [ ] **LG10** (Tùy chọn) Chặn hoặc ghi đè phản hồi tải chứng chỉ bằng DevTools (Network, Local overrides) để tải về khác byte gốc: hiện "không khớp", nút "Nhận lô" bị khóa.
- [ ] **LG11** (Tùy chọn) Chặn hẳn yêu cầu tải IPFS: báo lỗi tải, không báo khớp giả, có nút tải lại.
- [ ] **LG12** Bấm "Nhận lô", **từ chối** trong MetaMask: báo "Bạn đã từ chối ký", lô vẫn ở trạng thái chờ nhận.
- [ ] **LG13** Bấm lại và xác nhận: khung tiến trình chạy hết, hiện txHash; lô COCONUT-007 chuyển sang InTransit, chủ sở hữu NFT là ví Logistics.
- [ ] **LG14** COCONUT-007 biến khỏi "Chờ nhận", xuất hiện trong "Lô đang giữ"; Tổng quan: "Đang giữ" tăng 1.
- [ ] **LG15** Đăng nhập Farmer A: yêu cầu của COCONUT-007 hiện "Đã nhận" ở `/farmer/transfers`, chủ sở hữu ở `/farmer/batches` là Logistics.
- [ ] **LG16** Với COCONUT-008: bấm "Từ chối", xác nhận: yêu cầu thành "Đã từ chối", lô vẫn của Farmer A, hiện lại trong "Lô có thể chuyển" của Farmer A.
- [ ] **LG17** Trang công khai của COCONUT-007: timeline có "Logistics đã nhận" kèm txHash, lịch sử sở hữu có thêm Logistics.

### Luồng LC. Ghi nhiệt độ (lô đang giữ, trạng thái InTransit)

- [ ] **LG18** Chi tiết COCONUT-003 có biểu mẫu ghi nhiệt độ (nhiệt độ °C, vị trí). Lô không phải InTransit hoặc không do ví này giữ thì biểu mẫu bị khóa kèm lý do.
- [ ] **LG19** Nhập 12,5°C và vị trí, bấm ghi: MetaMask xác nhận; sau receipt, điểm mới xuất hiện trên biểu đồ và bảng (hiển thị 12,5°C, không phải 1250).
- [ ] **LG20** Số `readingId` không trùng với 1 đến 5 đã dùng (hệ thống tự cấp số kế tiếp).
- [ ] **LG21** Ghi 18°C hoặc 5°C: điểm đỏ, cảnh báo "ngoài ngưỡng 8 đến 15°C", không có chữ kết luận nhiễm khuẩn.
- [ ] **LG22** Nhiệt độ rỗng hoặc không phải số: báo lỗi, không gửi giao dịch.
- [ ] **LG23** **Từ chối** ký ở MetaMask: báo từ chối, không có điểm mới.
- [ ] **LG24** Thử thao tác trên lô bị khóa (nếu có lô hết hạn hoặc thu hồi do Logistics giữ): nút bị khóa kèm lý do.
- [ ] **LG25** Lịch sử readings sắp theo thời gian đo (observedAt), cho thấy giờ đo và giờ block khác nhau nếu có.
- [ ] **LG26** Trang công khai của lô hiện điểm nhiệt độ mới sau khi tải lại.

### Luồng LD. Bàn giao cho Retailer

Dùng lô COCONUT-007 (đã nhận ở LB).

- [ ] **LG27** `/logistics/outgoing`: mục "Lô có thể chuyển" chỉ có lô đang giữ, đang InTransit, chưa hết hạn, chưa thu hồi (COCONUT-003 và 007).
- [ ] **LG28** "Yêu cầu chuyển cho Retailer": hộp chọn người nhận hiện danh sách ví Retailer đọc từ hợp đồng (có `0x15d3…6A65`); không có ví Farmer hay Logistics.
- [ ] **LG29** Gửi yêu cầu, xác nhận trong MetaMask: lô vào "Yêu cầu đang chờ", biến khỏi "Lô có thể chuyển"; chủ sở hữu NFT vẫn là Logistics.
- [ ] **LG30** Một lô chỉ có một yêu cầu hoạt động: lô đang chờ không thể gửi thêm.
- [ ] **LG31** **Từ chối** ký giao dịch yêu cầu: báo từ chối, không có yêu cầu mới.
- [ ] **LG32** "Hủy yêu cầu" xác nhận: trạng thái "Đã hủy", lô quay lại "Lô có thể chuyển"; gửi lại được.
- [ ] **LG33** Sau khi Retailer nhận (luồng RB): yêu cầu thành "Đã nhận", lô biến khỏi "Lô đang giữ".
- [ ] **LG34** Sau khi Retailer từ chối: yêu cầu thành "Đã từ chối", lô vẫn của Logistics.

### Luồng LE. Quyền và cách ly

- [ ] **LG35** Đăng nhập **Farmer A** rồi gõ tay `/logistics/overview`: bị chặn (không đủ quyền), không thấy dữ liệu Logistics.
- [ ] **LG36** Đăng nhập **Retailer** rồi gõ tay `/logistics/incoming`: bị chặn.
- [ ] **LG37** Mở tay `/logistics/batches/COCONUT-001` (lô đã chuyển cho Retailer): báo không tìm thấy lô của ví này.
- [ ] **LG38** F5 ở một trang Logistics: vẫn đăng nhập, vẫn ở đúng trang.

---

# Phần 3. Kiểm thử vai trò Retailer

Dùng ví **Retailer** (#4, `0x15d3…6A65`). Mã mục: `RT`. Trạng thái lô seed ở bảng đầu Phần 2: Retailer đang giữ 001 (Sold), 002 (Delivered), 005 (Sold, thu hồi), 006 (Delivered, hết hạn).

## Các luồng của Retailer cần kiểm

| Luồng | Mục đích | Mã mục | Làm sau luồng nào |
| --- | --- | --- | --- |
| **RA. Tổng quan và lô đang giữ** | Dữ liệu đọc thật từ hợp đồng, nhãn hết hạn và thu hồi | RT01 đến RT07 | không |
| **RB. Nhận hàng từ Logistics** | Xác minh 3 hash rồi `acceptTransfer`, hoặc từ chối | RT08 đến RT16 | luồng LD của Logistics |
| **RC. Bán hết** | `markSold`, chặn lô bị khóa | RT17 đến RT24 | RA |
| **RD. Báo sự cố** | Upload báo cáo và `reportIncident` | RT25 đến RT36 | RA |
| **RE. Quyền và cách ly** | Vai trò khác không vào được | RT37 đến RT40 | không |

### Luồng RA. Tổng quan và lô đang giữ

- [ ] **RT01** `/retailer/overview`: lời chào đúng địa chỉ ví, số liệu đọc từ chain, không còn dữ liệu mẫu.
- [ ] **RT02** `/retailer/batches` có 4 lô: 001, 002, 005, 006. Không có 003 (Logistics giữ) và 004 (Farmer B giữ).
- [ ] **RT03** Trạng thái đúng: 001 Sold, 002 Delivered, 005 Sold kèm nhãn "Đã thu hồi", 006 Delivered kèm nhãn "Hết hạn".
- [ ] **RT04** Mở COCONUT-002: chủ sở hữu NFT là ví Retailer, hồ sơ công khai hiện đủ 3 thẻ và hash khớp, tab nhiệt độ có 5 điểm.
- [ ] **RT05** Ô tìm theo mã lô và lọc trạng thái hoạt động (gõ `005`, lọc "Đã thu hồi").
- [ ] **RT06** Lô COCONUT-005: hiện cảnh báo thu hồi rõ ràng, kể cả khi lô đã Sold.
- [ ] **RT07** Mở trang công khai từ trang chi tiết: đúng lô.

### Luồng RB. Nhận hàng từ Logistics

Điều kiện: ở luồng LD, Logistics đã gửi yêu cầu bàn giao COCONUT-007 cho Retailer, và gửi thêm COCONUT-003 (dùng cho ca từ chối).

- [ ] **RT08** `/retailer/incoming` hiện yêu cầu của COCONUT-007: bên gửi là Logistics, Request ID, thời gian theo giờ block.
- [ ] **RT09** Mở yêu cầu: hiện kết quả xác minh SHA-256 của metadata.json, certificate.pdf, batch.jpg so với hash trên chain; cả 3 khớp thì nút "Nhận lô" bấm được.
- [ ] **RT10** (Tùy chọn) Làm tệp tải về khác byte gốc bằng DevTools (Local overrides): "không khớp", nút nhận bị khóa.
- [ ] **RT11** Bấm nhận, **từ chối** trong MetaMask: báo từ chối, lô vẫn ở "Chờ nhận".
- [ ] **RT12** Xác nhận: khung tiến trình chạy hết, hiện txHash; COCONUT-007 thành Delivered, chủ sở hữu NFT là ví Retailer, xuất hiện trong "Lô đang giữ".
- [ ] **RT13** Lịch sử trên trang công khai có "Retailer đã nhận" kèm txHash; lịch sử sở hữu: Farmer A, Logistics, Retailer.
- [ ] **RT14** Với COCONUT-003: bấm "Từ chối", xác nhận: yêu cầu thành "Đã từ chối", lô vẫn của Logistics (kiểm ở trang Logistics).
- [ ] **RT15** Logistics thấy yêu cầu của COCONUT-007 thành "Đã nhận" (xem LG33), yêu cầu 003 thành "Đã từ chối" (xem LG34).
- [ ] **RT16** Ví khác Retailer không thấy và không nhận được yêu cầu này.

### Luồng RC. Bán hết (`markSold`)

- [ ] **RT17** `/retailer/sales`: danh sách "Lô có thể bán" chỉ gồm lô Delivered, chưa hết hạn, chưa thu hồi (COCONUT-002 và 007). Lô 001, 005 (Sold) và 006 (hết hạn) không có.
- [ ] **RT18** Ở trang chi tiết của lô bị khóa (006 hết hạn, 005 thu hồi), nút bán bị vô hiệu kèm lý do.
- [ ] **RT19** Bán COCONUT-002, **từ chối** ký: báo từ chối, lô vẫn Delivered.
- [ ] **RT20** Bán COCONUT-002 và xác nhận: khung tiến trình chạy hết, hiện txHash; lô thành Sold.
- [ ] **RT21** COCONUT-002 biến khỏi "Lô có thể bán", vẫn nằm trong "Lô đang giữ" với trạng thái Sold (Retailer vẫn giữ NFT).
- [ ] **RT22** Không bán lại được lô đã Sold (nút bị khóa; nếu cố gọi thì báo lỗi rõ).
- [ ] **RT23** Trang công khai của COCONUT-002 hiện "Sold · Đã bán" và có mốc bán hết kèm txHash.
- [ ] **RT24** Farmer A mở `/farmer/batches/COCONUT-002`: trạng thái đã đổi thành Sold.

### Luồng RD. Báo sự cố

Chuẩn bị tệp báo cáo: `backend/scripts/sample_data/incident-report.pdf`.

- [ ] **RT25** `/retailer/incidents/new`: danh sách lô để báo gồm lô Delivered hoặc Sold do ví này giữ (001, 002, 005, 006, và 007 nếu đã nhận). Không có lô Created hoặc InTransit.
- [ ] **RT26** Bước nhập: chọn COCONUT-001, nhập mô tả; để trống mô tả hoặc không chọn tệp thì báo lỗi, ở lại bước hiện tại.
- [ ] **RT27** Chọn một tệp không phải PDF (đổi đuôi `.txt` thành `.pdf`): báo "không phải PDF hợp lệ".
- [ ] **RT28** Chọn đúng PDF: hiện tên, dung lượng, SHA-256 tính từ byte tệp.
- [ ] **RT29** Gửi: báo cáo được tải lên IPFS, hiện CID thật; hash phản hồi của backend khớp hash tự tính.
- [ ] **RT30** MetaMask hiện giao dịch `reportIncident`; **từ chối**: báo từ chối, **không** có sự cố nào được ghi.
- [ ] **RT31** Xác nhận: khung tiến trình chạy hết, hiện txHash, hiện mã sự cố (incidentId).
- [ ] **RT32** Báo sự cố cho lô Sold (001) thành công; báo thêm cho lô Delivered (007 hoặc 006) cũng thành công; lô hết hạn hoặc thu hồi (005, 006) **vẫn báo được** (không bị chặn).
- [ ] **RT33** Trang công khai của lô vừa báo: timeline có mốc "Retailer báo sự cố" kèm txHash.
- [ ] **RT34** Đăng nhập Admin: sự cố vừa báo xuất hiện ở trang Sự cố (xem AD22), mở được tệp báo cáo và hash khớp.
- [ ] **RT35** Đăng nhập Farmer A, thử gọi trực tiếp upload loại `incident_report` (ví dụ bằng Postman hoặc `curl` với token của Farmer A): backend từ chối 403.
- [ ] **RT36** Báo cùng một lô nhiều lần: mỗi lần tạo sự cố mới với incidentId khác nhau (không ghi đè).

### Luồng RE. Quyền và cách ly

- [ ] **RT37** Đăng nhập **Farmer A** rồi gõ tay `/retailer/overview`: bị chặn.
- [ ] **RT38** Đăng nhập **Logistics** rồi gõ tay `/retailer/incoming`: bị chặn.
- [ ] **RT39** Mở tay `/retailer/batches/COCONUT-004` (Farmer B giữ): báo không tìm thấy lô của ví này.
- [ ] **RT40** F5 ở một trang Retailer: vẫn đăng nhập, vẫn ở đúng trang.

---

# Phần 4. Kiểm thử vai trò Admin

Dùng ví **Admin** (#0, `0xf39F…2266`). Mã mục: `AD`. Dữ liệu seed: một sự cố sẵn có (incidentId 1, của COCONUT-005, đã thu hồi). Ví #5 (`0x1Bc29…b7705`) chưa có quyền, dùng để thử cấp quyền.

## Các luồng của Admin cần kiểm

| Luồng | Mục đích | Mã mục | Làm sau luồng nào |
| --- | --- | --- | --- |
| **AA. Tổng quan** | Số liệu đọc thật từ chain | AD01 đến AD04 | không |
| **AB. Vai trò** | Cấp, thu hồi vai trò | AD05 đến AD14 | không |
| **AC. Trang trại** | Gán farmId cho Farmer | AD15 đến AD20 | AB |
| **AD. Sự cố và truy ngược** | Xem sự cố, tìm lô liên quan | AD21 đến AD30 | luồng RD của Retailer (cần sự cố ở COCONUT-001) |
| **AE. Thu hồi lô** | `recallBatch` từng lô, có lý do | AD31 đến AD42 | AD |
| **AF. Quyền** | Vai trò khác không vào được | AD43 đến AD45 | không |

### Luồng AA. Tổng quan

- [ ] **AD01** `/admin/overview`: không còn số liệu mẫu; tổng số lô, số sự cố, số lô đã thu hồi lấy từ chain.
- [ ] **AD02** Chain mới sau seed: 6 lô, 1 sự cố, 1 lô thu hồi (COCONUT-005); các con số khớp trang công khai.
- [ ] **AD03** Sau khi Farmer tạo thêm lô, tải lại: số lô tăng.
- [ ] **AD04** Mở một lô hoặc sự cố từ trang tổng quan: sang đúng trang chi tiết.

### Luồng AB. Vai trò

- [ ] **AD05** `/admin/roles` liệt kê thành viên theo vai trò, đọc từ contract: Admin (#0), Farmer (#1, #2), Logistics (#3), Retailer (#4).
- [ ] **AD06** Cấp vai trò Logistics cho ví #5: nhập địa chỉ, MetaMask xác nhận, báo thành công kèm txHash; ví #5 xuất hiện trong danh sách Logistics.
- [ ] **AD07** Địa chỉ sai định dạng hoặc rỗng: báo lỗi, không gửi giao dịch.
- [ ] **AD08** **Từ chối** ký khi cấp quyền: báo từ chối, danh sách không đổi.
- [ ] **AD09** Đăng nhập bằng ví #5: vào được `/logistics/overview` (đã có vai trò Logistics); trước khi cấp thì thấy "Chưa được cấp quyền".
- [ ] **AD10** Quay lại Admin, thu hồi vai trò Logistics của ví #5: xác nhận, ví #5 biến khỏi danh sách.
- [ ] **AD11** Ví #5 đăng nhập lại: không còn vào được trang Logistics.
- [ ] **AD12** Ví #5 đang mở dashboard Logistics khi bị thu hồi: thao tác ghi kế tiếp bị contract chặn và báo lỗi rõ (không báo thành công giả).
- [ ] **AD13** Cấp thêm vai trò Retailer cho ví #5 khi đã có Logistics: ví đó vào được cả hai nhóm trang.
- [ ] **AD14** Mỗi lần cấp hoặc thu hồi có event trên chain (kiểm bằng txHash trong trình khám phá hoặc log của Hardhat).

### Luồng AC. Trang trại (gán farmId)

- [ ] **AD15** `/admin/farms` hiện danh sách Farmer kèm farmId đọc từ chain: `FARM-A`, `FARM-B`.
- [ ] **AD16** Gán farmId `FARM-C` cho ví #5: xác nhận trong MetaMask, báo thành công; ví #5 trở thành Farmer (vào được `/farmer/overview`, Tạo lô hiện Farm ID `FARM-C`).
- [ ] **AD17** farmId rỗng hoặc ví rỗng: báo lỗi, không gửi giao dịch.
- [ ] **AD18** **Từ chối** ký: không có thay đổi.
- [ ] **AD19** Ví chưa được gán farmId (chưa qua AD16) thì không tạo được lô: `/farmer/create` không cho đi tiếp và báo thiếu farmId.
- [ ] **AD20** Đổi farmId của một Farmer đã có: lô cũ giữ farmId cũ (farmId ghi vào lô lúc tạo), lô mới dùng farmId mới.

### Luồng AD. Sự cố và truy ngược

Điều kiện: ở luồng RD, Retailer đã báo sự cố cho **COCONUT-001** (Sold). COCONUT-001 và 002 cùng FARM-A và HG-A01; 003 cùng FARM-A nhưng HG-A02; 004 thuộc FARM-B.

- [ ] **AD21** `/admin/incidents` liệt kê sự cố từ event `IncidentReported`: có sự cố #1 (COCONUT-005) và sự cố mới (COCONUT-001), kèm người báo, thời gian theo giờ block.
- [ ] **AD22** Mở một sự cố: hiện báo cáo (CID, `ipfs://CID`, URL gateway, SHA-256), mở được PDF, hash khớp với hash trên chain.
- [ ] **AD23** Truy ngược sự cố của COCONUT-001: hiện đường đi Farmer A → Logistics → Retailer, farmId `FARM-A`, harvestGroupId `HG-A01`, và lý do lô được đưa vào diện xem xét.
- [ ] **AD24** "Lô liên quan" của sự cố 001 chỉ có **COCONUT-002** (cùng farmId + harvestGroupId).
- [ ] **AD25** COCONUT-003 (cùng trang trại, khác nhóm) và COCONUT-004 (khác trang trại) **không** nằm trong diện xem xét; giao diện nói rõ là danh sách xem xét, chưa kết luận nhiễm khuẩn.
- [ ] **AD26** Sự cố #1 (COCONUT-005): hiện lô đã thu hồi và liên kết tới quyết định thu hồi.
- [ ] **AD27** Thời gian truy ngược đo thực tế: ghi lại số event, số lần gọi RPC và thời gian (mục tiêu vài giây) vào báo cáo.
- [ ] **AD28** Mở tay mã sự cố không tồn tại: báo không tìm thấy sự cố.
- [ ] **AD29** `/admin/batches` liệt kê mọi lô trên chain (6 lô seed trở lên), có lọc theo trạng thái, hết hạn, thu hồi.
- [ ] **AD30** Mở chi tiết một lô: hồ sơ, nhiệt độ, hành trình, QR giống trang công khai nhưng có nút thu hồi.

### Luồng AE. Thu hồi lô (`recallBatch`)

Chuẩn bị tệp lý do: `backend/scripts/sample_data/recall-reason.pdf`.

- [ ] **AD31** Từ sự cố của COCONUT-001, bấm thu hồi COCONUT-002 (lô liên quan): hộp thoại yêu cầu chọn sự cố tham chiếu và nhập lý do, có chọn tệp PDF lý do.
- [ ] **AD32** Không nhập lý do hoặc không chọn tệp: báo lỗi, không gửi.
- [ ] **AD33** Chọn đúng PDF: hiện tên, dung lượng, SHA-256; tải lên IPFS có CID thật; hash khớp.
- [ ] **AD34** **Từ chối** ký ở MetaMask: báo từ chối, lô **không** bị thu hồi.
- [ ] **AD35** Xác nhận: khung tiến trình chạy hết, hiện txHash; COCONUT-002 hiện nhãn "Đã thu hồi".
- [ ] **AD36** Chỉ COCONUT-002 bị thu hồi: COCONUT-001, 003, 004 không đổi (không thu hồi cả trang trại).
- [ ] **AD37** Trang công khai của COCONUT-002: cảnh báo thu hồi nổi bật kèm lý do và tệp lý do; lô đã Sold vẫn hiện cảnh báo (kiểm thêm với COCONUT-001 nếu bị thu hồi).
- [ ] **AD38** Đăng nhập Retailer: COCONUT-002 không bán được nữa (nút bị khóa), vẫn báo sự cố được.
- [ ] **AD39** Thu hồi lại lô đã thu hồi (COCONUT-002 hoặc 005): bị chặn, báo "đã thu hồi".
- [ ] **AD40** Thu hồi với mã sự cố không tồn tại: bị chặn, báo "không có sự cố".
- [ ] **AD41** Thu hồi một lô bằng sự cố của lô khác (sự cố của 001, lô 002): được phép vì sự cố tham chiếu có thể thuộc lô khác; sự cố phải tồn tại.
- [ ] **AD42** Lô đã thu hồi hết hạn (COCONUT-006 nếu thu hồi): vẫn thu hồi được (thu hồi không bị chặn bởi hết hạn).

### Luồng AF. Quyền

- [ ] **AD43** Đăng nhập **Farmer A**, gõ tay `/admin/roles`: bị chặn.
- [ ] **AD44** Đăng nhập **Retailer**, gõ tay `/admin/incidents`: bị chặn; đăng nhập **ví #5 chưa quyền** vào `/admin/...`: "Chưa được cấp quyền".
- [ ] **AD45** F5 ở một trang Admin: vẫn đăng nhập, vẫn ở đúng trang.

---

## Các việc chưa nằm trong danh sách này (chưa làm)

- Link Etherscan sau giao dịch: chỉ hiện trên Sepolia, kiểm sau khi deploy.
- Phần 2 đến 4 (Logistics, Retailer, Admin): chỉ kiểm được sau khi các trang tương ứng nối dữ liệu thật; hiện vẫn dùng dữ liệu mẫu.
- Thu hồi lô (AD31 đến AD42): backend đã nhận `recall_reason`, còn màn Admin chưa nối dữ liệu thật.
