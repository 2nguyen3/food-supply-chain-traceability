# Bước 08 — triển khai Ethereum Sepolia

Chuẩn bị ngày 25/11/2026; cập nhật 26/11/2026: đã deploy thật và cấp đủ role/farmId trên Sepolia. Manifest đã xác minh tại `docs/deployments/sepolia.json`; journal Ignition tại `contracts/ignition/deployments/chain-11155111/`. Tiến độ 10 công việc và phần cần Nini thực hiện: `docs/deployments/STEP08-PROGRESS.md`. Hosting HTTPS, dữ liệu demo testnet và kiểm thử bản triển khai chưa hoàn tất; không coi deploy contract là hoàn thành toàn bộ bước 08.

## 1. Nini chuẩn bị ví và RPC

1. Trong MetaMask, tạo ví mới dành riêng cho đồ án testnet. Không nhập lại seed/private key Hardhat, không dùng ví đang giữ tài sản thật. Tạo năm tài khoản và đặt tên Admin Sepolia, Farmer A Sepolia, Farmer B Sepolia, Logistics Sepolia, Retailer Sepolia. Tên chỉ giúp nhận diện; quyền thực phải được Admin cấp trên contract.
2. Bật hiển thị mạng thử nghiệm và chọn **Ethereum Sepolia** (chainId 11155111), không chọn OP/Base/Arbitrum Sepolia và không dùng Hardhat 31337.
3. Sao chép địa chỉ công khai của năm tài khoản. Lấy ETH test từ faucet trong danh sách chính thức: https://ethereum.org/developers/docs/networks/#sepolia . Nhận ETH cho cả năm ví; số dư cần đủ cho deploy, cấp quyền và các giao dịch demo. Script preflight ước tính riêng phí deploy, không bảo đảm toàn bộ ngân sách demo.
4. Tạo endpoint Ethereum Sepolia ở nhà cung cấp RPC của nhóm. Endpoint backend/deploy có thể chứa API key: chỉ lưu trong env bị bỏ qua bởi Git. RPC đưa vào frontend là thông tin công khai; đặt giới hạn origin/quota tại nhà cung cấp.
5. Chép `.env.sepolia.example` thành `.env.sepolia` ở root. Tự điền RPC, private key **chỉ tài khoản Admin Sepolia**, và địa chỉ công khai của bốn ví còn lại. Không gửi private key, seed phrase hay JWT trong chat/ảnh. Script không cần private key bốn ví nghiệp vụ; các ví đó ký DApp qua MetaMask. IoT cần khóa Logistics riêng khi đến lượt simulator.

Giữ nguyên `.env` backend và `frontend/.env.local` đang chạy local. Không chuyển cấu hình ứng dụng trước khi có deployment thật.

## 2. Kiểm tra trước deploy

Node 22, chạy từ `contracts` (thay đường dẫn root nếu cần):

```sh
cd /Users/nguyen/Documents/GitHub/food-supply-chain-traceability/contracts
nvm use 22
node --env-file=../.env.sepolia ./node_modules/hardhat/dist/src/cli.js compile
node --env-file=../.env.sepolia scripts/sepolia.mjs preflight
```

Preflight chỉ đọc/ước tính, không gửi transaction. Chặn sai mạng, thiếu cấu hình, địa chỉ zero/trùng nhau, tài khoản Hardhat mặc định #0–19, thiếu số dư và ABI lệch giữa artifact/FE/BE/ABI xuất. Không in RPC key hoặc private key. Trước deploy cần chạy contract tests và các check ứng dụng trên đúng source sẽ deploy; không dùng kết quả test cũ để xác nhận source đã đổi.

Nếu ABI đổi, xuất lại bằng script có sẵn rồi đồng bộ ba bản ABI trước preflight. Không thay ABI để bỏ qua báo lỗi bytecode/ABI.

## 3. Deploy bằng module Ignition có sẵn

```sh
node --env-file=../.env.sepolia ./node_modules/hardhat/dist/src/cli.js ignition deploy ignition/modules/FoodTraceability.ts --network sepolia
```

Lệnh này dùng ETH test và phát giao dịch thật trên Sepolia. Giữ journal `contracts/ignition/deployments/chain-11155111/`; nếu timeout, xem receipt/journal và chạy lại cùng deployment ID để Ignition tiếp tục, không xóa journal hoặc deploy lại tùy tiện. Ghi lại hash transaction tạo contract từ journal/explorer.

## 4. Xác minh và lưu manifest

Thay `TX_HASH_DEPLOY_THAT` bằng hash thật, không dùng chuỗi ví dụ:

```sh
node --env-file=../.env.sepolia scripts/sepolia.mjs finalize TX_HASH_DEPLOY_THAT
node --env-file=../.env.sepolia scripts/sepolia.mjs roles
node --env-file=../.env.sepolia scripts/sepolia.mjs roles --apply
node --env-file=../.env.sepolia scripts/sepolia.mjs roles
```

`finalize` đối chiếu chain, receipt thành công, ví deploy, creation bytecode, runtime bytecode và block canonical. Chỉ sau đó lưu manifest có chain/address/block/txHash/ABI hash/runtime hash/commit/trạng thái dirty và ví nghiệp vụ. Không lưu RPC/key. Nếu source còn thay đổi chưa commit, manifest ghi `dirty: true`; cần giữ source tương ứng làm bằng chứng, không coi commit hash một mình là toàn bộ source đã deploy.

`roles` mặc định chỉ đọc và liệt kê thao tác còn thiếu. `--apply` cấp FARM-A/FARM-B và role Logistics/Retailer; không ghi đè farmId đã gán khác. Ví deploy đã là Admin theo constructor. Mỗi transaction ghi hash trước chờ receipt; nếu chưa có receipt, lần chạy sau dừng để tránh gửi trùng. Script đọc lại quyền sau khi xác nhận; không tạo lô hoặc tự đổi owner/lifecycle.

Manifest là dữ liệu công khai có thể đưa vào Git sau khi kiểm tra, nhưng không tự commit. Source verification trên Etherscan chưa được tự động hóa; explorer tìm được receipt không đồng nghĩa đã xác minh source contract.

## 5. FE / BE / IoT dùng cùng deployment

Lấy `address`, `deployBlock` và `logisticsAddress` từ manifest thật. Không dùng địa chỉ local `0x5FbD…` làm địa chỉ Sepolia. Các ứng dụng đã đọc biến hiện có; không tạo bộ config runtime thứ hai.

| Phía | Cấu hình |
| --- | --- |
| Frontend | VITE_CHAIN_ID=11155111; VITE_PUBLIC_RPC_URL=RPC dành cho browser; VITE_CONTRACT_ADDRESS=address; VITE_DEPLOY_BLOCK=deployBlock; VITE_API_BASE_URL=backend HTTPS; VITE_IPFS_GATEWAY=gateway thật |
| Backend | CHAIN_ID=11155111; RPC_URL=RPC Sepolia; CONTRACT_ADDRESS=address; DEPLOY_BLOCK=deployBlock; ALLOWED_ORIGIN và AUTH_DOMAIN đúng frontend; DATABASE_URL/MASTER_KEY/PINATA_JWT riêng cho deployment |
| IoT | RPC_URL=RPC Sepolia; CHAIN_ID=11155111; CONTRACT_ADDRESS=address; DEPLOY_BLOCK=deployBlock; IOT_LOGISTICS_ADDRESS=logisticsAddress; IOT_PRIVATE_KEY tự cấu hình bí mật |

Sau đổi VITE_* phải restart/rebuild frontend. Backend restart để tải settings mới. Không đổi MASTER_KEY trên DB chứa hóa đơn hiện có mà không có kế hoạch di chuyển khóa.

Simulator nhận `--manifest docs/deployments/sepolia.json` (xem `iot/README.md`), phát hiện env xung đột manifest. Chạy dry-run trước; chọn token thật đang InTransit và thuộc Logistics. Không giả tokenId hoặc tự dùng COCONUT-003 nếu chưa tạo trên Sepolia.

## 6. Phần còn phải chạy thật

Kiểm tra chuẩn bị ngày 25/11/2026: 95 contract tests đạt; 2 tests công cụ Sepolia đạt với provider giả lập; ABI FE/BE/export khớp artifact; `git diff --check` đạt. Preflight khi thiếu RPC dừng đúng trước phát giao dịch. Đây chưa phải kết quả chạy trên Sepolia. Không thay code frontend trong bước này, không chạy lại lint/build frontend.

- P07-01/09/10/11: cấu hình, deploy, receipt, manifest và cấp role/farmId.
- P07-04: tạo bốn lô theo kịch bản trên DApp hoặc script seed Sepolia đã được rà riêng. `backend/scripts/seed_local.py` dành cho local; không chạy vào Sepolia. Chưa có `seed_demo.py` testnet được kiểm chứng, không tuyên bố đã seed.
- P07-12/19: các ca contract và năm readings trên Sepolia, lưu hash/receipt thật. Unit test công cụ không thay thế các ca này.
- Hosting HTTPS/DB deploy riêng/origin/QR điện thoại P07-13..18 cần chọn nhà cung cấp và cấu hình thật; chưa thay bằng localhost. Không đưa app/database/secret lên dịch vụ khi chưa có lựa chọn của nhóm.
- Bước 09: tổng duyệt MetaMask bốn role, IPFS/private docs, truy ngược/thu hồi, QR và responsive. Chưa tự tick CODE.md.

Tài liệu tham chiếu chính thức: https://hardhat.org/docs/reference/configuration và https://hardhat.org/ignition/docs/getting-started .
