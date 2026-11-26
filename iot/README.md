# Cảm biến giả lập COCOMARK

Thực hiện P02-21/22 và P06-10..14. Dữ liệu nhiệt độ/vị trí là **giả lập**; khi chạy gửi thật, txHash/receipt là kết quả của mạng đã cấu hình. Script chỉ gọi `recordTransit`, không đổi owner, lifecycle, role hay tạo lô; không gọi Pinata/backend.

## Chuẩn bị

Chạy từ thư mục gốc repository. Có thể dùng ngay Python đã cài dependencies backend:

```sh
backend/.venv/bin/python iot/simulate.py --help
```

Nếu cần môi trường IoT riêng, dùng Python 3.12:

```sh
python3.12 -m venv iot/.venv
iot/.venv/bin/python -m pip install -r iot/requirements.lock
```

Lock tái sử dụng dependency đã ghim của backend (Web3.py 7.13.0, python-dotenv 1.2.4); không cần cài lại nếu dùng venv backend hiện tại.

Giữ các dịch vụ hiện có chạy. **Không chạy lại seed hoặc reset Hardhat chỉ để chạy simulator.** Kiểm tra frontend/backend/IoT dùng cùng deployment.

Các biến cấu hình lấy từ môi trường shell trước, rồi `.env` gốc, rồi `iot/.env` cho giá trị còn thiếu:

Nếu đã truyền đủ cấu hình qua biến môi trường/manifest (và khóa khi gửi), script không đọc lại `.env`. Điều này cũng tránh chờ file `.env` bị iCloud offload. Khi file có cờ `dataless`, tải file về máy trước khi dùng; không in nội dung secret để chẩn đoán. Nếu dependency trong `.venv` bị offload, tạo venv ngoài thư mục đồng bộ iCloud rồi cài theo lock, thay đường dẫn Python trong các lệnh bên dưới bằng Python của venv đó.

| Biến | Ý nghĩa |
|---|---|
| RPC_URL | HTTP(S) RPC; local thường là http://127.0.0.1:8545 |
| CHAIN_ID | 31337 cho Hardhat; 11155111 cho Sepolia |
| CONTRACT_ADDRESS | Địa chỉ deployment đang dùng |
| DEPLOY_BLOCK | Block deploy, dùng giới hạn quét events |
| IOT_LOGISTICS_ADDRESS | Địa chỉ công khai ví Logistics dự kiến |
| IOT_PRIVATE_KEY | Khóa ký tương ứng, chỉ cần khi gửi giao dịch |

Sao chép `iot/.env.example` thành `iot/.env` và tự điền địa chỉ/khóa trên máy. Không gửi khóa trong chat, không commit `.env`. Khóa Hardhat công khai chỉ dùng trên mạng local; ví Sepolia dùng khóa testnet riêng, có ETH thử nghiệm trả phí. Không dùng ví chứa tài sản thật.

Có thể truyền `--manifest đường/dẫn/deployment.json`, chứa `chainId`, `address`, `deployBlock`, `logisticsAddress`. Giá trị manifest xung đột biến môi trường sẽ bị từ chối; không tự đoán deployment. ABI mặc định: `contracts/abi/FoodTraceability.json`, có thể chọn bằng `--abi`.

## CSV và lô đủ điều kiện

`readings.csv` có năm mẫu 10, 12, 18, 13, 11°C. `tempCenti` là số nguyên: **1250 = 12,50°C**. Vị trí mẫu là chuỗi minh họa, không chứng minh vị trí thiết bị thật.

Các cột bắt buộc: `readingId,tokenId,tempCenti,observedAt,location`. `observedAt` là Unix seconds hoặc `now`; `now` lấy timestamp block gần nhất khi chuẩn bị từng reading, không dùng đồng hồ máy. Contract kiểm thời điểm không tương lai/không lùi. Các reading cùng timestamp vẫn hợp lệ theo đặc tả.

Token mặc định trong CSV là **#3**, tương ứng lô InTransit trong seed local hiện tại. Nếu lô đó đã được bàn giao cho Retailer, hết hạn hoặc bị thu hồi thì không dùng được. Chọn một lô InTransit thực sự thuộc Logistics bằng `--token-id`; không tự sửa trạng thái lô cho simulator.

`readingId` phải mới trong phạm vi token. Script đối chiếu events: ID đã có cùng dữ liệu thì bỏ qua, khác dữ liệu thì dừng. Với `now`, khi chạy lại giữ thời điểm đã ghi; không coi thời gian mới là một reading mới.

## Kiểm tra trước, rồi gửi

```sh
backend/.venv/bin/python iot/simulate.py --dry-run
```

Dry-run kiểm mạng, bytecode, role, owner, trạng thái và `eth_call`; không ký hoặc phát giao dịch. Không yêu cầu private key. Nó không bảo đảm mọi điều kiện sẽ còn đúng trong tương lai, hoặc mô phỏng trạng thái tích lũy của cả năm giao dịch; mỗi lần gửi thật đều kiểm tra lại.

Sau khi xác nhận cấu hình và lô đích:

```sh
backend/.venv/bin/python iot/simulate.py --count 5 --interval 2
```

Lệnh trên **gửi giao dịch thật lên mạng cấu hình**. Chỉ chạy một simulator và tránh gửi giao dịch khác bằng cùng ví trong lúc chạy. Script lấy nonce pending/latest, ký và đợi receipt từng giao dịch trước khi tiếp tục.

Muốn chọn lô khác:

```sh
backend/.venv/bin/python iot/simulate.py --token-id 3 --dry-run
```

Đổi số 3 thành token thực tế. Không truyền khóa qua tham số dòng lệnh.

## Nhật ký và timeout

Mặc định ghi `.local-data/iot-transactions.csv` (được Git bỏ qua). Các trường gồm chainId, contract, genesisHash, ví, tokenId, readingId, tempCenti, observedAt, location, txHash, status, gasUsed.

- `prepared`: đã ký và lưu txHash, **chưa khẳng định gửi thành công**.
- `confirmed`: receipt có status 1.
- `reverted`: receipt có status 0; dừng gửi phần còn lại.

Khi timeout hoặc RPC lỗi sau khi ký, script dừng và in txHash. Dùng:

```sh
backend/.venv/bin/python iot/simulate.py --receipt 0xTHAY_BANG_TX_HASH_THUC
```

Thay toàn bộ giá trị mẫu bằng hash 0x + 64 ký tự hex. Lệnh chỉ hỏi receipt, không gửi giao dịch. Không có receipt chưa đồng nghĩa giao dịch thất bại: kiểm RPC, mạng và Activity trước khi quyết định. Lần chạy tiếp theo đối chiếu các dòng prepared với receipt và events; không tự phát lại một giao dịch chưa rõ kết quả.

Journal thuộc mạng/contract/genesis/ví khác bị từ chối. Khi nhóm chủ động dựng mạng mới, dùng `--output` riêng cho lần dựng đó và giữ nhật ký cũ để đối chiếu. Đừng đổi output để bỏ qua giao dịch đang pending trên cùng mạng.

## Xem kết quả

Mở chi tiết đúng lô trên DApp: tab Nhiệt độ và Hành trình & NFT. Cần thấy năm events và txHash; nhiệt độ chia 100 để hiển thị °C. Với ngưỡng mẫu 8–15°C, có một mẫu 18°C vượt ngưỡng. Điều này không tự chứng minh thực phẩm nhiễm khuẩn và không tự thu hồi lô.

Local không có Etherscan; txHash tra qua RPC/receipt. Sepolia chỉ dùng explorer Sepolia sau khi có deployment thật.

## Kiểm tra mã

```sh
backend/.venv/bin/python -m unittest discover -s iot/tests -v
```

Unit tests kiểm CSV, đơn vị, ID trùng, số lớn, guard trạng thái, timeout và journal. Việc đánh dấu I07 hoàn tất còn cần quan sát DApp trên môi trường nghiệm thu; không tự tick CODE.md chỉ từ unit test.
