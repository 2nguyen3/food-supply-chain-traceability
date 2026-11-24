# Tiến độ bước 08

Cập nhật 26/11/2026. Chỉ nhánh nguyen. Không commit/push/merge/reset. Ngân sách hosting **0 đồng, không thẻ, không trial cần thanh toán**. Không thay dữ liệu local, không tự tick CODE.md. Cần đọc manifest/journal và receipt trước khi tiếp tục, không deploy lại chỉ vì hội thoại bị gián đoạn.

## Trạng thái 10 công việc

| Mục | Công việc | Trạng thái và bằng chứng |
| --- | --- | --- |
| 1 | Cấu hình và số dư | Đạt preflight live: chain 11155111, năm ví đều 0.05 SepoliaETH trước deploy; ABI ba phía khớp artifact |
| 2 | Deploy và manifest | Đã xác minh receipt, creation/runtime bytecode, block canonical và Admin. Manifest sepolia.json; block 12215175 |
| 3 | Role và farmId | Bốn receipt confirmed trong manifest; đọc lại roles có actions=[]; Farmer A/FARM-A, Farmer B/FARM-B, Logistics, Retailer |
| 4 | Cấu hình FE/BE/IoT | Đã chuẩn bị .env.hosting.example và file .env.hosting ignored riêng; DATABASE_URL Neon đã kết nối thật, còn chờ URL frontend/backend để chốt runtime hosting |
| 5 | PostgreSQL riêng và backend HTTPS | Neon Free Singapore/production/neondb đã kết nối Direct psycopg qua TLS; Alembic lên 0003, có đủ 5 bảng. Có Dockerfile/render.yaml plan free; chưa có API HTTPS trên Render |
| 6 | Frontend HTTPS | Có frontend/vercel.json cho SPA deep link; chưa đăng nhập/deploy Vercel |
| 7 | IPFS/private docs/login trên hosting | Chờ API/DB và URL frontend thực. Không dùng kết quả local thay nghiệm thu hosting |
| 8 | Lô demo và nghiệp vụ Sepolia/IoT | Chưa tạo lô testnet. Không chạy seed_local.py vào Sepolia. Cần ví nghiệp vụ ký qua MetaMask; hiện chỉ có khóa Admin phục vụ deploy/cấp role |
| 9 | QR điện thoại | Chờ URL Vercel HTTPS và lô thật có thể truy xuất. Không dùng localhost cho QR điện thoại |
| 10 | Hướng dẫn/minh chứng | Đang cập nhật tài liệu này, manifest và journal; chưa có bộ minh chứng demo hoàn chỉnh |

Contract: `0x650525fC71559CafcF37DcF8fA2844a5577f2FD3`.

Deployment: https://sepolia.etherscan.io/tx/0x0f2921bcf1577fb95a1ce945284bb2480972861a518735d7f58711538cb5e999 . Explorer receipt không đồng nghĩa đã verify source trên Etherscan. Manifest ghi dirty=true vì đang có thay đổi chưa commit, không tự commit để đổi trạng thái.

Không đổi frontend/.env.local hoặc .env backend đang dùng cho local. .env.hosting mới giữ riêng cấu hình Sepolia, bản sao JWT Pinata hiện có và MASTER_KEY mới cho DB hosted; không chứa private key. Không đổi MASTER_KEY sau khi DB lưu hóa đơn mà chưa di chuyển khóa. Không commit/in/chụp nội dung các env thật.

## Việc Nini cần thực hiện tiếp

Đã hoàn thành các mục 1–4 dưới đây ngày 26/11: tạo Neon Free Singapore và lưu DATABASE_URL vào .env.hosting. Agent kết nối database rỗng rồi chạy Alembic upgrade head thành công (0003); không chạm DB local. Còn mục 5 đăng ký Render/Vercel. Không chạy neon init/deploy ghi đè env của ứng dụng.

1. Đăng ký/đăng nhập https://console.neon.tech bằng Google/GitHub.
2. Tạo project `cocomark-sepolia`, plan Free, PostgreSQL 17 nếu được chọn; chọn region gần backend (dự kiến Singapore nếu cả hai hỗ trợ), database tên `cocomark`. Không nhập thẻ. Nếu bị yêu cầu thanh toán thì dừng và báo lại.
3. Mở Connect và lấy **direct connection string** của database mới. Trong .env.hosting ở root, tự điền DATABASE_URL. Đổi tiền tố `postgresql://` thành `postgresql+psycopg://`, giữ nguyên user/password/host/database và `sslmode=require`. Không dán vào chat. Không dùng food_dev/food_test local. Có thể giữ channel_binding=require nếu Neon cung cấp.
4. Báo đã điền. Agent kiểm kết nối/migration trên DB mới trước; không reset DB local. Chỉ migration khi xác nhận URL là database vừa tạo dành cho deploy.
5. Sau đó đăng ký Vercel Hobby và Render Free; các bước màn hình sẽ được hướng dẫn theo tài khoản thực tế. Không mua domain, dùng *.vercel.app và *.onrender.com. Render Free có ngủ/khởi động lại; Neon có hạn mức.

Lưu ý nguồn deploy: Render đọc code đã có trên GitHub. Repository hiện có code chưa commit/push. Cần Nini duyệt và tự commit/push bộ source được kiểm tra trước khi kết nối Render, hoặc phê duyệt cách phân phối source khác. Agent không tự commit/push. Không deploy nhánh remote cũ rồi báo là source local mới nhất.

## Cấu hình dự kiến

- Render: Web Service, Docker, branch nguyen, Root Directory backend, plan Free, health /health. Image chạy user không phải root, migration trước server. Free không có disk bền; tài liệu nằm trên IPFS, DB Neon giữ metadata/khóa đã bọc, không lưu file cần bền vào filesystem Render.
- Vercel: Hobby, Root Directory frontend, Vite, npm ci + npm run build, output dist. SPA rewrite đã có. Đặt production branch nguyen nếu dùng Git integration, giữ deployment công khai để Consumer/điện thoại truy cập được.
- Frontend chỉ nhận các biến VITE_*; tuyệt đối không đưa MASTER_KEY/PINATA_JWT/private key vào VITE_*. Endpoint RPC browser là công khai, giới hạn origin/quota tại Alchemy.
- Lấy domain Vercel ổn định rồi đặt ALLOWED_ORIGIN=https://domain và AUTH_DOMAIN=domain trên Render. Backend cần URL HTTPS thực trước build frontend cuối cùng.
- IoT tiếp tục chạy trên máy nhóm qua RPC Sepolia, không cần hosting simulator liên tục. Cần riêng khóa Logistics testnet, giữ ở env ignored, không gửi chat; thực hiện sau khi có lô InTransit thực.

## Kiểm tra đã chạy trong lượt triển khai

- Preflight live đạt; Ignition deploy thành công; finalize và bốn giao dịch roles thành công; đọc lại actions=[].
- 12 tests startup hosted đạt (không kết nối DB): chặn DB local/không TLS, sai mạng/address/block, thiếu key, origin/domain không khớp.
- Frontend lint/typecheck/build trên source/lockfile đồng nhất ngoài iCloud; build đạt, còn cảnh báo chunk >500 kB.
- Docker image local `cocomark-backend-step8:local` build đạt bằng context sạch cùng source ngoài iCloud; pip check trong image đạt. Chạy image không env bị chặn đúng trước migration (exit 1, thiếu cấu hình). Đây là image ARM64 local; chưa xác nhận build/chạy trên Render. Neon thật đã migration bằng runtime backend đúng lockfile trên máy local.
- Neon: trước migration tables=[]; sau migration có alembic_version, auth_nonces, sessions, document_grants, documents; revision=0003. Xác nhận psycopg pgconn.ssl_in_use=True cho chặng client-to-Neon. pg_stat_ssl phía database trả False do proxy, không dùng chỉ số đó để kết luận chặng client không TLS. Không chạy pytest/seed trên DB deploy và không in mật khẩu/URL kết nối.
- Chưa dùng browser để nghiệm thu bản hosted, chưa tạo dữ liệu on-chain demo hoặc kết luận bước 08 hoàn tất.
