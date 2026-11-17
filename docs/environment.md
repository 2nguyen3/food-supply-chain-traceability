# Môi trường phát triển

Cập nhật 22/10/2026 · Máy: Windows 11 Home · Chạy trong PowerShell, từ thư mục gốc repo. File này chỉ ở máy cá nhân (không push).

## 1. Thành phần và phiên bản

### Công cụ nền (cài một lần trên máy)
| Thành phần | Phiên bản | Dùng để | Cài bằng |
|---|---|---|---|
| Git | 2.55.0 | quản lý mã nguồn | đã có |
| Python | 3.12.10 | backend, IoT (`.python-version` ghi 3.12) | `py install 3.12` |
| Node.js | 22.23.4 | contract, frontend (`.nvmrc` ghi 22; KeHoach cần ≥ 22.13) | `fnm install 22` |
| npm | 10.9.9 | đi kèm Node | |
| fnm | 1.39.0 | chọn phiên bản Node theo `.nvmrc` | `winget install Schniz.fnm` |
| Docker Desktop | Docker 29.9.1, Compose v5.6.0 | chạy PostgreSQL khi dev | tải từ docker.com |
| PostgreSQL | 16 (ảnh `postgres:16`) | cơ sở dữ liệu dev và test | `docker compose up -d db` |

Máy còn Python 3.14.7 và 3.11.9: bản mặc định của `py` vẫn là **3.14**; chỉ môi trường ảo của repo dùng 3.12.

### Thư viện backend (`backend/.venv`, khóa trong `backend/requirements.lock`)
| Thư viện | Phiên bản | Vai trò |
|---|---|---|
| FastAPI | 0.153.0 | khung API |
| uvicorn | 0.54.0 | chạy server |
| Pydantic | 2.14.1 | kiểm tra dữ liệu |
| SQLAlchemy | 2.1.5 | truy cập DB |
| Alembic | 1.20.0 | migration |
| psycopg | 3.3.6 | driver PostgreSQL |
| web3 | 7.13.0 | đọc contract |
| eth-account | 0.14.0 | kiểm chữ ký ví |
| cryptography | 50.0.2 | AES-GCM |
| httpx | 0.28.1 | gọi Pinata |
| python-multipart | 0.0.32 | nhận file upload |
| python-dotenv | 1.2.4 | đọc `.env` |
| pytest | 9.1.1 | test |

### Thư viện contract (`contracts/node_modules`, khóa trong `package-lock.json`)
| Thư viện | Phiên bản |
|---|---|
| Hardhat | 3.20.0 |
| OpenZeppelin Contracts | 5.4.0 |
| Solidity (solc) | 0.8.28 (Hardhat tự tải khi chạy test đầu tiên) |
| ethers | 6.17.0 |

### Thư viện frontend (`frontend/node_modules`, khóa trong `package-lock.json`)
| Thư viện | Phiên bản |
|---|---|
| React | 19.3.1 |
| Vite | 7.3.7 |
| TypeScript | 5.8.3 |
| ethers | 6.17.0 |
| recharts | 3.10.1 |
| qrcode.react | 4.2.0 |

## 2. Cách tải (từ máy trống, theo thứ tự)

**Bước 1. Python 3.12** (cài cạnh các bản khác, không đổi bản mặc định):
```powershell
py install 3.12
py -3.12 --version              # phải in Python 3.12.x
```

**Bước 2. Node 22:**
```powershell
winget install Schniz.fnm
# đóng và mở lại terminal, rồi:
fnm install 22
fnm use 22
node --version                  # phải in v22.x
```

**Bước 3. Docker Desktop:** tải và cài từ docker.com, bật WSL2 khi được hỏi, mở Docker Desktop và đợi trạng thái *Engine running*.

**Bước 4. Thư viện backend:**
```powershell
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
```

**Bước 5. Thư viện contract và frontend:**
```powershell
npm ci --prefix contracts
npm ci --prefix frontend
```
`contracts` có một thư viện lấy thẳng từ GitHub (`forge-std`), nên bước này cần mạng và Git.

**Bước 6. Tạo `.env`:**
```powershell
Copy-Item .env.example .env
```
Mở `.env` và tự đặt mật khẩu cho 3 tài khoản (`POSTGRES_ADMIN_PASSWORD`, `DEV_DB_PASSWORD`, `TEST_DB_PASSWORD`), chỉ dùng chữ và số. Sửa **cùng mật khẩu đó** vào `DATABASE_URL` và `TEST_DATABASE_URL`. Host trong URL phải là `127.0.0.1`.

**Bước 7. PostgreSQL và migration:**
```powershell
docker compose up -d db
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
```

**Bước 8. Kiểm tra:**
```powershell
backend\.venv\Scripts\python.exe -m pytest backend      # 1 passed
cd contracts; npx hardhat test; cd ..                   # 5 passing
cd frontend; npm run build; cd ..                       # build thành công
```

## 3. Thư viện nằm ở đâu
| Nơi | Chứa | Ghi chú |
|---|---|---|
| `backend\.venv\` | thư viện Python | luôn dùng 3.12; gọi `backend\.venv\Scripts\python.exe`, không dùng `python` trần |
| `contracts\node_modules\`, `frontend\node_modules\` | thư viện Node | |
| volume `food_pgdata` (Docker) | dữ liệu PostgreSQL | `docker compose down -v` sẽ xóa |

Các thư mục trên đều bị `.gitignore` chặn, không lên GitHub. Người khác clone repo sẽ tự cài lại theo mục 2; thư viện luôn ra đúng phiên bản vì đã khóa trong `requirements.lock` và `package-lock.json`. `.venv` trỏ về bản Python 3.12 đã cài, nên gỡ 3.12 thì `.venv` hỏng và phải tạo lại.

## 4. PostgreSQL cục bộ
| Thành phần | Giá trị |
|---|---|
| Container | `food-traceability-db`, chỉ mở `127.0.0.1:5432`, volume `food_pgdata` |
| Database dev / test | `food_dev` (role `food_dev`) / `food_test` (role `food_test`), tách quyền, không vào chéo được |
| Tài khoản quản trị | `postgres_admin`, chỉ dùng để tạo database và role |
| Biến môi trường | `DATABASE_URL`, `TEST_DATABASE_URL` trong `.env` (mẫu: `.env.example`) |
| Alembic | `backend/alembic/`, revision gốc `0001 baseline` (trống) |

Lệnh thường dùng:
```powershell
docker compose up -d db                 # bật (cần Docker Desktop đang chạy)
docker compose stop                     # tắt, giữ dữ liệu
docker compose down -v                  # tắt và xóa dữ liệu
cd backend
.venv\Scripts\python.exe -m alembic upgrade head      # áp dụng migration lên food_dev
.venv\Scripts\python.exe -m alembic current           # xem revision hiện tại
```

## 5. Lưu ý
- **Node trong terminal mới:** `winget` chỉ thêm `fnm` vào PATH, chưa thêm `node`. Mỗi terminal chạy trước: `fnm env --use-on-cd --shell power-shell | Out-String | Invoke-Expression`. Muốn tự động, thêm dòng đó vào `$PROFILE`.
- **Terminal vừa cài công cụ mới phải mở lại** thì mới thấy lệnh mới (`docker`, `fnm`).
- **Python trong VS Code:** `.vscode/settings.json` (local) trỏ interpreter vào `backend\.venv` và đặt `PIP_REQUIRE_VIRTUALENV=true`, nên terminal VS Code của repo dùng 3.12 và `pip` từ chối cài ngoài venv. Terminal khác vẫn dùng bản mặc định 3.14.
- **`requirements.lock`:** dòng `uvloop` có marker `; sys_platform != "win32"` để Windows bỏ qua (Linux và Render vẫn cài). Thay đổi này chưa commit.
- **Host phải là `127.0.0.1`, không dùng `localhost`:** `localhost` thử IPv6 trước, lệnh Alembic treo hơn 60 giây (đo được); với `127.0.0.1` mỗi lệnh khoảng 1,2 giây.
- **`db/init.sh`** (tạo database và role) chỉ chạy lần đầu khi volume trống. Đổi mật khẩu sau khi DB đã tạo thì phải `ALTER ROLE`; sửa `.env` không tự đổi mật khẩu trong DB.
- **Không ghi tiếng Việt có dấu vào `backend/alembic.ini`:** Alembic đọc file này bằng bảng mã mặc định của Windows và sẽ lỗi.
- **`.gitattributes`** (`*.sh text eol=lf`) giữ `db/init.sh` không bị đổi sang CRLF khi checkout, nếu không container không chạy được script.
- **`.env.old`** là bản `.env` cũ của lần thử trước, bị `.gitignore` chặn; xóa được.

## 6. Chưa làm
- `iot/.venv` và `iot/requirements.lock` (làm khi tới phần IoT).
- Migration tạo 4 bảng (revision `0002`, việc P03-18).

## 7. Gateway IPFS
Đọc file từ IPFS qua gateway riêng của Pinata, không dùng gateway công cộng (hay bị giới hạn tốc độ hoặc ngừng):
- Backend: `.env` đặt `IPFS_GATEWAY=https://peach-elderly-thrush-53.mypinata.cloud` (xem `.env.example`).
- Frontend: nên dùng cùng gateway cho trang trace và màn xem hồ sơ. Tên miền này công khai, có thể chia sẻ cho nhóm.
- Mỗi môi trường deploy tự đặt lại biến này. Chi tiết và kết quả kiểm: `docs/notes/api-spec.md`, mục "Gateway IPFS".

## 8. Kiểm tra luồng đầy đủ ở local
`backend/tests/e2e_local.py` chạy trọn luồng nghiệp vụ trên contract thật (Hardhat node) cùng backend và `food_test` (66 bước: vai trò, đăng nhập, tạo lô, bind hồ sơ, hóa đơn riêng, bàn giao hai chặng, IoT, bán, sự cố, thu hồi, lịch sử). Không thuộc pytest; chạy tay mỗi khi sửa contract hoặc API, và trước khi deploy.
1. `docker compose up -d db`
2. Cửa sổ 1: `cd contracts; npx hardhat compile; npx hardhat node` (giữ mở, cổng 8545)
3. Cửa sổ 2: `cd backend; .venv\Scripts\python.exe tests\e2e_local.py` (thêm `--real-ipfs` để upload thật lên Pinata)

Kết quả in từng dòng `OK`/`FAIL` và dòng cuối `TẤT CẢ ĐẠT` hoặc `CÓ LỖI` (thoát mã 1 nếu lỗi). Dùng ví tạm trong bộ nhớ, tự xóa dữ liệu `food_test` sau khi chạy. Đã đạt 66/66 ngày 30/10/2026.

## 9. Chạy frontend với dữ liệu thật ở local
1. `docker compose up -d db`; cửa sổ A: `cd contracts; npx hardhat compile; npx hardhat node` (node MỚI, giữ mở).
2. Cửa sổ B: `cd backend; .venv\Scripts\python.exe scripts\seed_local.py` (cần `PINATA_JWT` trong `.env`): deploy contract (địa chỉ cố định `0x5FbD…0aa3` khi node mới), cấp vai trò cho tài khoản Hardhat #1 đến #4, upload hồ sơ mẫu thật lên Pinata, tạo 6 lô COCONUT-001..006 (Sold, Delivered, InTransit, Created, Sold đã bị thu hồi, Delivered đã hết hạn). Script chờ khoảng 1 phút để lô 006 qua hạn nên chạy lâu hơn trước.
3. Cửa sổ C: `cd backend; .venv\Scripts\python.exe -m uvicorn app.main:app --reload`
4. Cửa sổ D: `cd frontend; npm ci; npm run dev`. Cấu hình ở `frontend/.env.local` (không commit; mẫu ở `.env.example`).
5. Mở `http://localhost:5173/trace/31337/0x5FbDB2315678afecb367f032d93F642f64180aa3/1` (tokenId 1 đến 4).
Tài khoản Hardhat #0 Admin, #1 Farmer A, #2 Farmer B, #3 Logistics, #4 Retailer: khóa riêng công khai, lấy từ log của `npx hardhat node`, chỉ dùng cho local. Tắt node là mất dữ liệu; chạy lại bước 1 và 2.

## 10. Đăng nhập bằng MetaMask ở local
**Cấu hình backend cho chain local.** `.env` giữ cấu hình Sepolia (chưa deploy); khi chạy local thì truyền đè bằng biến môi trường (biến môi trường thắng `.env`), không sửa `.env`:
```
cd backend
$env:RPC_URL='http://127.0.0.1:8545'; $env:CHAIN_ID='31337'; $env:CONTRACT_ADDRESS='0x5FbDB2315678afecb367f032d93F642f64180aa3'; $env:DEPLOY_BLOCK='1'; $env:AUTH_DOMAIN='127.0.0.1:5173'
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
`AUTH_DOMAIN` phải trùng host mở frontend (`127.0.0.1:5173`), nếu không MetaMask cảnh báo khác domain. Mở frontend bằng đúng địa chỉ đó (`http://127.0.0.1:5173`).

**Cài MetaMask lần đầu.**
1. Cài extension MetaMask (metamask.io/download), tạo ví mới với mật khẩu riêng, không dùng ví thật.
2. Import tài khoản: biểu tượng tài khoản, Thêm tài khoản, Nhập khóa riêng, dán khóa Hardhat tương ứng (lấy trong log `npx hardhat node`; #1 Farmer A, #2 Farmer B, #3 Logistics, #4 Retailer, #0 Admin). Khóa này công khai, chỉ dùng local.
3. Không cần tự thêm mạng: bấm Kết nối ở trang `/connect`, nếu ví sai mạng thì trang tự đề nghị thêm và chuyển sang Hardhat (RPC `http://127.0.0.1:8545`, chainId 31337).

**Luồng.** `/connect` (chọn tài khoản) → `/auth/network` nếu sai mạng → `/auth/sign` (backend cấp thông điệp EIP-4361, ví ký, backend trả token 20 phút) → vai trò đọc từ hợp đồng (`hasRole`) → vào `/{vai trò}/overview`, hoặc `/auth/no-access` nếu ví chưa được cấp quyền. Phiên được lưu trong `sessionStorage` của tab nên F5 vẫn còn đăng nhập (mất khi đóng tab; khôi phục chỉ khi MetaMask vẫn đang chọn đúng tài khoản, vai trò đọc lại từ hợp đồng). Đổi tài khoản trong MetaMask thì phiên bị đóng; đổi mạng thì chuyển sang `/auth/network`; hết 20 phút thì phải đăng nhập lại. Mỗi lần dựng lại node (mất dữ liệu chain) thì sau khi seed, nên đặt lại tài khoản MetaMask: Cài đặt, Nâng cao, Xóa dữ liệu hoạt động (nếu không MetaMask báo sai nonce).

