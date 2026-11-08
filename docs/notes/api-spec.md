# API backend

Nguồn: KeHoach mục 15.2, 18, 19. Sơ đồ: `docs/diagrams/03-sequence.drawio` (page Đăng nhập bằng chữ ký ví, Tạo lô).

**Trạng thái:** danh sách endpoint, xác thực, mã hóa, bind là theo KeHoach. Phần mà KeHoach không nêu (định dạng lỗi, mã lỗi, mẫu thông điệp ký, kiểu dữ liệu, mã HTTP cụ thể) là **đề xuất 21/10/2026, chờ review nhóm**, đánh dấu ⟨đề xuất⟩.

## Quy ước chung ⟨đề xuất⟩
- Base URL: `{VITE_API_BASE_URL}`. JSON UTF-8, trừ upload (`multipart/form-data`) và tải file (nhị phân).
- Địa chỉ ví nhận ở mọi dạng hợp lệ, **trả về và lưu dạng chữ thường** (`0x` + 40 hex).
- Thời gian ISO 8601 UTC (`2026-10-21T08:00:00Z`). `tokenId` là chuỗi số thập phân (tránh mất độ chính xác vì uint256).
- `sha256` là chuỗi hex 64 ký tự chữ thường, không có `0x`. Contract dùng `bytes32`, frontend thêm `0x` khi gọi.
- Xác thực: `Authorization: Bearer <access_token>`. Thiếu, sai hoặc hết hạn → `401`.
- CORS: chỉ `ALLOWED_ORIGIN`. `OPTIONS` preflight do middleware xử lý.
- Lỗi luôn có dạng:
  ```json
  { "error": { "code": "NONCE_INVALID", "message": "Challenge không hợp lệ hoặc đã hết hạn." } }
  ```
  `code` ổn định để frontend và test dùng; `message` là câu mô tả cho người đọc.

## Tổng quan

| Method | Path | Auth | Mục đích |
|---|---|---|---|
| GET | /health | Không | Kiểm tra sống |
| POST | /auth/challenge | Không | Tạo nonce (5 phút) gắn wallet, domain, chainId |
| POST | /auth/verify | Không | Kiểm chữ ký, consume nonce nguyên tử, trả access token (20 phút) |
| POST | /auth/logout | Bearer | Thu hồi phiên |
| POST | /documents | Bearer | Upload (≤ 10 MB, kiểm nội dung), tạo draft; tài liệu riêng được mã hóa trước khi lên IPFS |
| POST | /documents/{id}/bind | Bearer | Gắn draft vào tokenId sau receipt `BatchCreated` khớp |
| GET | /documents | Bearer | Liệt kê tài liệu riêng đã gắn vào lô mà ví được phép đọc (lọc `?token_id=`) |
| GET | /documents/{id}/content | Bearer | Kiểm phiên + vai trò on-chain + ACL, giải mã, trả file |
| POST | /documents/{id}/grants | Bearer | Uploader cấp quyền đọc cho ví |
| DELETE | /documents/{id}/grants/{wallet} | Bearer | Uploader thu hồi quyền |

---

## GET /health
Không cần token. Giữ nguyên đúng nội dung hiện tại (test đang kiểm đúng giá trị này).
```
200  {"status": "ok"}
```

---

## POST /auth/challenge
Tạo nonce dùng một lần, hết hạn sau 5 phút, gắn với ví, domain và chainId.

Request:
```json
{ "wallet": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" }
```
Response `200`:
```json
{
  "wallet": "0xab5801a7d398351b8be11c439e05c5b3259aec9b",
  "nonce": "kP3x9vQ2mT7yL1wZ8nR4cD6hJ0sB5aGf",
  "domain": "food-traceability.example.app",
  "chain_id": 11155111,
  "issued_at": "2026-10-21T08:00:00Z",
  "expires_at": "2026-10-21T08:05:00Z",
  "message": "food-traceability.example.app wants you to sign in with your Ethereum account:\n0xab5801a7d398351b8be11c439e05c5b3259aec9b\n\nĐăng nhập Food Supply Chain Traceability. Chữ ký này không tạo giao dịch và không tốn phí.\n\nURI: https://food-traceability.example.app\nChain ID: 11155111\nNonce: kP3x9vQ2mT7yL1wZ8nR4cD6hJ0sB5aGf\nIssued At: 2026-10-21T08:00:00Z\nExpiration Time: 2026-10-21T08:05:00Z"
}
```
- ⟨đề xuất⟩ `message` theo khuôn EIP-4361 (Sign-In with Ethereum): mục đích, nonce, domain, chainId, issuedAt, expirationTime, đúng như KeHoach 19.1. Frontend ký **nguyên văn** chuỗi này bằng `personal_sign`.
- Backend không có cột lưu `message`. Nó **dựng lại** từ các cột (wallet, nonce, domain, chain_id, issued_at, expires_at) bằng cùng một hàm, nên mọi bên cần dùng chung khuôn trên.
- `nonce`: ≥ 128 bit ngẫu nhiên (`secrets.token_urlsafe(24)`), cột UNIQUE.
- `domain` lấy từ `AUTH_DOMAIN`, không nhận từ client.

Lỗi: `422 INVALID_WALLET` nếu `wallet` không phải địa chỉ 42 ký tự hợp lệ.

---

## POST /auth/verify
Request:
```json
{
  "wallet": "0xab5801a7d398351b8be11c439e05c5b3259aec9b",
  "nonce": "kP3x9vQ2mT7yL1wZ8nR4cD6hJ0sB5aGf",
  "signature": "0x3a1f…c91b"
}
```
- ⟨đề xuất⟩ Client gửi `nonce` và `signature`, **không** gửi lại `message`, để khỏi tin vào chuỗi do client dựng. Backend lấy challenge theo `nonce`, dựng lại `message`, rồi kiểm.

Trình tự:
1. Tìm challenge theo `nonce` và `wallet`.
2. Khôi phục địa chỉ bằng `eth_account` (`encode_defunct` + `recover_message`) trên `message` dựng lại; phải bằng `wallet`.
3. Consume nguyên tử: `UPDATE auth_nonces SET used_at = now() WHERE nonce = :n AND wallet = :w AND used_at IS NULL AND expires_at > now()`. **0 dòng → từ chối.** Hai request đồng thời chỉ một request thắng.
4. Sinh token ngẫu nhiên 32 byte, lưu **SHA-256 của token** vào `sessions` (không lưu token), hết hạn sau `TOKEN_TTL_MINUTES` = 20.

Response `200`:
```json
{
  "access_token": "mHq7…(43 ký tự urlsafe)",
  "token_type": "Bearer",
  "expires_at": "2026-10-21T08:21:03Z",
  "wallet": "0xab5801a7d398351b8be11c439e05c5b3259aec9b"
}
```
- Token chỉ trả về một lần. Frontend giữ trong bộ nhớ và lưu một bản trong `sessionStorage` (khóa `cocomark:session`: địa chỉ ví, token, thời điểm hết hạn) để sống qua F5; bản lưu mất khi đóng tab. Không dùng `localStorage`. Vai trò và chainId **không** được lưu, mỗi lần khôi phục đều đọc lại từ hợp đồng và từ ví.
- Khôi phục sau F5: chỉ khi bản lưu còn hạn và `eth_accounts` trả đúng ví đã lưu (ví bị khóa hoặc đổi tài khoản thì xóa bản lưu, phải ký lại). Backend trả `401` ở bất kỳ request nào thì frontend xóa phiên và yêu cầu đăng nhập lại. Đăng xuất, đổi ví và hết hạn đều xóa bản lưu.
- Không trả vai trò: frontend đọc `hasRole` từ contract, backend cũng đọc lại mỗi lần cần.

Lỗi:

| HTTP | code | Khi nào |
|---|---|---|
| 401 | `NONCE_INVALID` | nonce không tồn tại, hết hạn, đã dùng, hoặc không thuộc ví này |
| 401 | `SIGNATURE_INVALID` | chữ ký không khôi phục ra đúng ví |
| 422 | `INVALID_REQUEST` | thiếu trường hoặc sai định dạng |

⟨đề xuất⟩ Dùng chung một `code` cho mọi nguyên nhân của nonce để không lộ nonce nào còn tồn tại. Lý do chi tiết đưa vào log phía server.

---

## POST /auth/logout
Header: `Authorization: Bearer …`. Không có body.
```
204  (no content)
```
Đặt `sessions.revoked_at = now()`. Dùng lại token sau đó → `401`. Gọi lặp lại với token đã thu hồi cũng `401`.

---

## POST /documents
`multipart/form-data`:

| Trường | Bắt buộc | Giá trị |
|---|---|---|
| `file` | có | tệp, tối đa 10 MB |
| `doc_type` | có | `certificate` · `image` · `metadata` · `invoice` · `incident_report` · `recall_reason` |

⟨đề xuất⟩ `visibility` **suy ra từ `doc_type`**, client không gửi: `invoice` → `private`, các loại còn lại → `public`.

Kiểm tra (theo thứ tự):
1. Token hợp lệ.
2. Vai trò on-chain của người upload (đọc contract): `certificate`, `image`, `metadata`, `invoice` cần `FARMER_ROLE`; `incident_report` cần `RETAILER_ROLE`; `recall_reason` (lý do thu hồi lô) cần `ADMIN_ROLE`. RPC lỗi → `503`.
3. Kích thước ≤ 10 MB, **kiểm nội dung thật** (magic bytes), không tin duy nhất phần mở rộng:

| doc_type | Nội dung chấp nhận |
|---|---|
| `certificate`, `invoice` | PDF (bắt đầu bằng `%PDF-`) |
| `image` | JPEG (`FF D8 FF`) hoặc PNG (`89 50 4E 47`) |
| `metadata` | JSON hợp lệ UTF-8 (parse được), đúng lược đồ metadata |
| `incident_report`, `recall_reason` | PDF hoặc JSON hợp lệ UTF-8 |

4. Tính `sha256` trên **byte gốc nhận được** (với `invoice` là hash của bản rõ, trước khi mã hóa). Không parse rồi stringify lại JSON.
5. Public: upload nguyên byte lên Pinata (`network=public`) → `cid`. Private: mã hóa AES-256-GCM trước (xem mục Mã hóa), upload **ciphertext** → `cid`.
6. Ghi `documents` với `token_id = NULL` (draft).

Response `201` (public):
```json
{
  "id": "6d1f0a52-8a0e-4c7e-9b5f-2e3c1d7a9f10",
  "doc_type": "certificate",
  "visibility": "public",
  "status": "draft",
  "cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "mime_type": "application/pdf",
  "size_bytes": 184233,
  "uploader": "0xab5801a7d398351b8be11c439e05c5b3259aec9b",
  "token_id": null,
  "created_at": "2026-10-21T08:03:12Z"
}
```
Response `201` (private, `invoice`): cùng cấu trúc, `visibility: "private"`, và `cid` trỏ tới ciphertext. **Không** trả `wrapped_key`, `aad` hay bất kỳ thông tin khóa nào.

Lỗi:

| HTTP | code | Khi nào |
|---|---|---|
| 401 | `UNAUTHENTICATED` | thiếu hoặc sai token |
| 403 | `ROLE_REQUIRED` | ví thiếu vai trò cho `doc_type` này |
| 413 | `FILE_TOO_LARGE` | > 10 MB |
| 415 | `UNSUPPORTED_CONTENT` | nội dung không khớp `doc_type` |
| 422 | `INVALID_REQUEST` | thiếu `file` hoặc `doc_type` sai |
| 502 | `IPFS_UPLOAD_FAILED` | Pinata lỗi; không tạo bản ghi, cho phép thử lại |
| 503 | `CHAIN_UNAVAILABLE` | không đọc được vai trò từ RPC |

---

## POST /documents/{id}/bind
Gắn draft vào một lô sau khi có receipt thành công. Chỉ uploader mới bind được.

Request (3 tài liệu của `createBatch`: `certificate`, `image`, `metadata`):
```json
{
  "token_id": "1",
  "tx_hash": "0x9c2e…41ab"
}
```
Backend kiểm, tất cả phải đạt:
- `chainId` đúng; giao dịch gửi tới `CONTRACT_ADDRESS`; **receipt `status = 1`**.
- Receipt có event `BatchCreated` với `farmer == uploader` và `tokenId == token_id`.
- Draft khớp dữ liệu trên chain: `metadata` → `sha256` bằng `metadataHash` và `cid` bằng `metadataCID`; `certificate` → `sha256` bằng `certificateHash`; `image` → `sha256` bằng `imageHash`.

Request (tài liệu bổ sung sau mint: `invoice`, `incident_report`, `recall_reason`): `tx_hash` **không bắt buộc** (KeHoach: không cần giao dịch `BatchCreated` mới).
```json
{ "token_id": "1" }
```
Thay vào đó backend kiểm vai trò và quyền trên lô: `invoice` do Farmer là chủ ban đầu của lô (đã ghi trong `BatchCreated.farmer`) đăng; `incident_report` do Retailer đang giữ lô; `recall_reason` do Admin (lô phải tồn tại).

Response `200`:
```json
{
  "id": "6d1f0a52-8a0e-4c7e-9b5f-2e3c1d7a9f10",
  "status": "bound",
  "token_id": "1",
  "bind_tx_hash": "0x9c2e…41ab"
}
```
Tính chất:
- **Nguyên tử:** hoặc cập nhật đủ `token_id` + `bind_tx_hash`, hoặc không gì cả.
- **Lặp lại an toàn:** bind lại cùng `token_id` và `tx_hash` trả đúng kết quả cũ (`200`), không tạo bản ghi trùng.
- **Chống bind chéo:** bind tài liệu đã gắn vào lô khác → `409`.

Lỗi:

| HTTP | code | Khi nào |
|---|---|---|
| 403 | `NOT_UPLOADER` | người gọi không phải uploader |
| 404 | `DOCUMENT_NOT_FOUND` | id không tồn tại |
| 409 | `ALREADY_BOUND` | đã gắn vào `token_id` hoặc `tx_hash` khác |
| 422 | `TX_RECEIPT_INVALID` | không có receipt, receipt thất bại, sai contract, thiếu `BatchCreated`, sai uploader hoặc tokenId |
| 422 | `HASH_MISMATCH` | `sha256` / `cid` của draft không khớp dữ liệu trên chain |
| 503 | `CHAIN_UNAVAILABLE` | RPC lỗi |

⟨đề xuất⟩ Receipt chưa có (giao dịch còn pending) trả `422 TX_RECEIPT_INVALID` với `message` nói rõ "chưa có receipt", để frontend thử lại sau vài giây.

---

## GET /documents/{id}/content
Chỉ cho **tài liệu riêng**. ⟨đề xuất⟩ Tài liệu công khai đọc trực tiếp từ IPFS qua `cid`; gọi endpoint này với tài liệu công khai trả `400 DOCUMENT_IS_PUBLIC` kèm `cid`.

Điều kiện đọc (tất cả phải đúng, kiểm **mỗi lần gọi**, không tin vai trò lưu từ lúc đăng nhập):
1. Phiên hợp lệ.
2. Ví đang giữ **ít nhất một** vai trò nghiệp vụ trên contract (`FARMER_ROLE`, `LOGISTICS_ROLE` hoặc `RETAILER_ROLE`), đọc lại từ chain.
3. Ví là uploader hợp lệ **hoặc** có grant chưa thu hồi (`revoked_at IS NULL`).

Vì thế `Admin` bị `403` dù có `ADMIN_ROLE`, trừ khi Admin cũng giữ vai trò nghiệp vụ *và* có grant. Admin không tự cấp quyền cho mình (chỉ uploader mới cấp được).

Thực hiện: lấy ciphertext từ IPFS theo `cid`, mở `wrapped_key` bằng `MASTER_KEY`, giải mã AES-256-GCM với `aad` đã lưu, xác minh tag, trả file.

Response `200`: nội dung nhị phân với
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-6d1f0a52.pdf"
X-Document-Sha256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
Cache-Control: no-store
```
Frontend có thể đối chiếu `X-Document-Sha256` với hash tự tính trên dữ liệu nhận được.

Lỗi:

| HTTP | code | Khi nào |
|---|---|---|
| 400 | `DOCUMENT_IS_PUBLIC` | tài liệu công khai, đọc từ IPFS |
| 401 | `UNAUTHENTICATED` | thiếu hoặc sai token |
| 403 | `ACCESS_DENIED` | thiếu vai trò, không phải uploader, không có grant, hoặc grant đã thu hồi |
| 404 | `DOCUMENT_NOT_FOUND` | id không tồn tại |
| 502 | `CIPHERTEXT_INVALID` | lấy được ciphertext nhưng tag GCM sai hoặc dữ liệu bị sửa. **Không trả dữ liệu từng phần.** |
| 502 | `IPFS_FETCH_FAILED` | không tải được ciphertext |
| 503 | `CHAIN_UNAVAILABLE` | RPC lỗi. **Từ chối** chứ không đoán quyền |

⟨đề xuất⟩ `ACCESS_DENIED` dùng cho mọi nguyên nhân thiếu quyền, kể cả khi id tồn tại, nên người không có quyền cũng không phân biệt được "không tồn tại" với "không được phép" khi đoán id.

---

## GET /documents
Liệt kê **tài liệu riêng** (hiện chỉ `invoice`) đã gắn vào lô mà ví gọi được phép đọc: là uploader, hoặc có grant chưa thu hồi. Bản nháp (`token_id = NULL`) và tài liệu công khai không có trong danh sách (tài liệu công khai đọc thẳng từ IPFS).

Query: `token_id` (tùy chọn, số nguyên dương dạng chuỗi) lọc theo lô. Sắp theo `created_at` giảm dần.

Điều kiện giống `GET /documents/{id}/content`: phiên hợp lệ và ví đang giữ vai trò nghiệp vụ trên contract (đọc contract mỗi lần; RPC lỗi → `503`, không đoán quyền). Admin không có vai trò nghiệp vụ nên nhận `403`.

Response `200`: mảng các `DocumentOut` (xem POST /documents) kèm:
```json
{ "can_manage": true, "grants": [ { "document_id": "…", "wallet": "0x…", "granted_by": "0x…", "granted_at": "…", "revoked_at": null } ] }
```
`can_manage = true` khi ví là uploader; chỉ khi đó `grants` có dữ liệu (gồm cả grant đã thu hồi, có `revoked_at`). Người được cấp quyền nhận `can_manage = false`, `grants = []`. Không trả cột mã hóa (`wrapped_key`, `aad`…).

Lỗi: `401 UNAUTHENTICATED`, `403 ACCESS_DENIED`, `422 INVALID_REQUEST` (`token_id` sai), `503 CHAIN_UNAVAILABLE`.

---

## POST /documents/{id}/grants
Chỉ **uploader** của tài liệu mới cấp được. Vai trò Admin không tự cấp quyền đọc cho mình.

Request:
```json
{ "wallet": "0x1b3c5d7e9f1a2b4c6d8e0f1a2b3c4d5e6f708192" }
```
Kiểm: ví nhận là địa chỉ hợp lệ và đang giữ ít nhất một vai trò nghiệp vụ trên contract (đọc chain). ⟨đề xuất⟩ Ví chưa có vai trò → `422 WALLET_NOT_ELIGIBLE`.

Response `201` (tạo mới) hoặc `200` (đã có grant còn hiệu lực, hoặc cấp lại sau khi thu hồi; xem db-schema):
```json
{
  "document_id": "6d1f0a52-8a0e-4c7e-9b5f-2e3c1d7a9f10",
  "wallet": "0x1b3c5d7e9f1a2b4c6d8e0f1a2b3c4d5e6f708192",
  "granted_by": "0xab5801a7d398351b8be11c439e05c5b3259aec9b",
  "granted_at": "2026-10-21T08:10:00Z",
  "revoked_at": null
}
```
Lỗi: `401 UNAUTHENTICATED`, `403 NOT_UPLOADER`, `404 DOCUMENT_NOT_FOUND`, `422 WALLET_NOT_ELIGIBLE`, `422 INVALID_WALLET`, `400 DOCUMENT_IS_PUBLIC` (không cấp grant cho tài liệu công khai), `503 CHAIN_UNAVAILABLE`.

---

## DELETE /documents/{id}/grants/{wallet}
Chỉ uploader. Đặt `revoked_at = now()`.
```
204  (no content)
```
- Chặn **các lần tải sau**. Không thu hồi được file đã tải về.
- Grant không tồn tại hoặc đã thu hồi → `404 GRANT_NOT_FOUND`.
- Lỗi khác: `401`, `403 NOT_UPLOADER`, `404 DOCUMENT_NOT_FOUND`.

---

## Mã hóa tài liệu riêng
- Mỗi file: data key 32 byte + IV 12 byte ngẫu nhiên, AES-256-GCM (`cryptography.AESGCM`); không tái dùng IV với cùng key.
- AAD = `schemaVersion` + `documentId` + `uploader`; lưu **đúng byte AAD** để giải mã; tag 16 byte.
- Gói lên IPFS (`core/crypto.py`): `"FTE"` + 1 byte `schemaVersion` + IV (12) + tag (16) + ciphertext; **không kèm key**. AAD = `schemaVersion|documentId|uploader` (uploader viết thường), lưu đúng byte trong cột `aad`.
- `MASTER_KEY` là 32 byte, viết dạng hex 64 ký tự (hoặc base64). Sai định dạng hoặc thiếu thì backend từ chối mã hóa.
- Data key bọc bằng `MASTER_KEY` (AES-GCM, IV mới): DB lưu `wrapped_key`, `wrap_iv`, `wrap_tag`.
- Tag sai → từ chối hoàn toàn. Không log khóa.
- Lưu fingerprint (SHA-256) của file thử nghiệm để đối chiếu, không ghi khóa vào log.

## Biến môi trường backend
`RPC_URL, CONTRACT_ADDRESS, CHAIN_ID, DEPLOY_BLOCK, PINATA_JWT, MASTER_KEY, DATABASE_URL, ALLOWED_ORIGIN, AUTH_DOMAIN, TOKEN_TTL_MINUTES=20`.
`ALLOWED_ORIGIN` là origin của frontend (có thể nhiều origin, ngăn cách bằng dấu phẩy; không dùng `*`). CORS chỉ mở cho origin đó, method `GET/POST/DELETE`, header `Authorization`/`Content-Type`, không cho credentials (token là Bearer, không cookie), và lộ `X-Document-Sha256`, `Content-Disposition` cho frontend đọc. Để trống thì không mở CORS. Backend từ chối (503) khi RPC lỗi, sai `CHAIN_ID` hoặc `CONTRACT_ADDRESS` không có bytecode.
Tùy chọn `IPFS_GATEWAY` (gateway riêng của Pinata, ví dụ `https://<tên>.mypinata.cloud`): được thử trước các gateway công cộng, vì gateway công cộng hay trả HTTP 429 hoặc ngừng phục vụ.

### Gateway IPFS (đã kiểm 28/10/2026)
- Gateway công cộng (`gateway.pinata.cloud`, `ipfs.io`, `dweb.link`, `w3s.link`) trả HTTP 429 hoặc "switching", một số hết thời gian chờ: **không dùng làm đường đọc chính**.
- Gateway riêng của nhóm: `https://peach-elderly-thrush-53.mypinata.cloud` (tên miền công khai, không phải bí mật). Đọc file: `<gateway>/ipfs/<cid>`. Đã kiểm: tải đúng byte, 15 lần liên tiếp không bị 429.
- **Frontend (trang trace, màn xem hồ sơ P05-14) nên đọc file qua gateway này**, đặt trong biến `VITE_IPFS_GATEWAY`, và khi tải lỗi thì báo lỗi rõ chứ không báo "đã xác minh". Backend dùng cùng gateway qua `IPFS_GATEWAY`.
- Bản deploy (P07-15/16, P07-17) phải đặt lại biến này trên nền tảng hosting. Gói miễn phí có thể giới hạn băng thông hằng tháng: theo dõi trước buổi demo.
`AUTH_DOMAIN` khớp domain của frontend và nằm trong thông điệp ký. `MASTER_KEY` của bản triển khai khác bản cục bộ.

## metadata.json (đã chốt 21/10/2026)
DApp tạo JSON, giữ nguyên một chuỗi byte, upload qua `POST /documents` với `doc_type = metadata`. Backend tính SHA-256 trên byte nhận được, trả `cid` + `sha256`; DApp so với hash tự tính trước khi gọi `createBatch`. Bản ghi `documents` lưu cả hồ sơ công khai lẫn tài liệu riêng (cột `visibility`).

## Bảng mã lỗi tổng hợp ⟨đề xuất⟩
`UNAUTHENTICATED` 401 · `NONCE_INVALID` 401 · `SIGNATURE_INVALID` 401 · `ROLE_REQUIRED` 403 · `NOT_UPLOADER` 403 · `ACCESS_DENIED` 403 · `DOCUMENT_NOT_FOUND` 404 · `GRANT_NOT_FOUND` 404 · `ALREADY_BOUND` 409 · `FILE_TOO_LARGE` 413 · `UNSUPPORTED_CONTENT` 415 · `INVALID_REQUEST` 422 · `INVALID_WALLET` 422 · `WALLET_NOT_ELIGIBLE` 422 · `TX_RECEIPT_INVALID` 422 · `HASH_MISMATCH` 422 · `DOCUMENT_IS_PUBLIC` 400 · `CIPHERTEXT_INVALID` 502 · `IPFS_UPLOAD_FAILED` 502 · `IPFS_FETCH_FAILED` 502 · `CHAIN_UNAVAILABLE` 503 · `NOT_FOUND` 404 · `METHOD_NOT_ALLOWED` 405 · `SERVER_MISCONFIGURED` 500 · `INTERNAL_ERROR` 500 (không lộ chi tiết nội bộ). Mọi lỗi đều dạng `{"error": {"code", "message"}}`.

## Điểm cần nhóm xác nhận khi review
Đã được bạn duyệt 21/10/2026 (xem `CLAUDE.local.md`, mục Quyết định đã duyệt): các mục 1–5. Các dấu ⟨đề xuất⟩ khác trong file (mã lỗi chi tiết, `WALLET_NOT_ELIGIBLE`, mã HTTP) chưa có trong decisions.md nên vẫn chờ review.
1. Định dạng lỗi `{"error": {...}}` (thay vì `{"detail": ...}` mặc định của FastAPI, cần handler tùy chỉnh).
2. `visibility` suy ra từ `doc_type` (client không gửi).
3. Client gửi `nonce` + `signature` thay vì gửi cả `message`.
4. `GET /documents/{id}/content` chỉ cho tài liệu riêng.
5. `invoice` do Farmer (chủ ban đầu của lô) đăng; `incident_report` do Retailer đang giữ lô; `recall_reason` do Admin.
6. (Duyệt 08/11/2026) Thêm `GET /documents` (liệt kê tài liệu riêng được phép đọc), loại `recall_reason`, và cho `incident_report` nhận PDF hoặc JSON.
