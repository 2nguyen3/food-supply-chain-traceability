# Schema PostgreSQL

Nguồn: KeHoach mục 4.2, 15.1, 18, 19. Sơ đồ: `docs/diagrams/04-data-model.drawio` (page ERD PostgreSQL).

Không có bảng tài khoản (danh tính = địa chỉ ví, vai trò đọc từ contract). Không có bảng cache event.
Kiểu cột và index dưới đây là **đề xuất**, KeHoach chỉ nêu tên trường.

## Môi trường database (đã duyệt 22/10/2026)
Một container `postgres:16` cục bộ (`docker-compose.yml`), hai database và hai role riêng; bản deploy dùng PostgreSQL riêng của nền tảng.

| Môi trường | Database | Role (chủ database) | Biến | Khi nào dùng |
|---|---|---|---|---|
| Dev cục bộ | `food_dev` | `food_dev` | `DATABASE_URL` | chạy backend, Alembic |
| pytest | `food_test` | `food_test` | `TEST_DATABASE_URL` | test backend; được xóa và dựng lại tùy ý |
| Deploy | do nền tảng cấp (P07-15) | do nền tảng cấp | cấu hình trên nền tảng | bản chạy trên internet, mật khẩu và `MASTER_KEY` khác bản cục bộ |

- Tài khoản quản trị của container (`postgres_admin`) chỉ dùng để tạo database và role; ứng dụng không dùng.
- `db/init.sh` thu hồi `CONNECT` khỏi `PUBLIC`: role dev không vào được `food_test` và ngược lại (đã kiểm chứng bằng cách thử đăng nhập chéo).
- pytest phải **từ chối chạy** nếu tên database không kết thúc bằng `_test`.
- Đặt host là `127.0.0.1`, không dùng `localhost` (Docker Desktop: `localhost` thử IPv6 trước và treo rất lâu).
- `db/init.sh` chỉ chạy lần đầu khi volume trống. Đổi cấu hình role/database về sau: `docker compose down -v` rồi `docker compose up -d db` (xóa dữ liệu).
- Alembic: `backend/alembic/`, revision gốc `0001 baseline` (trống); bốn bảng dưới đây được tạo ở revision `0002` (P03-18, đã chạy trên `food_dev`); revision `0003` thêm `recall_reason` vào ràng buộc `ck_documents_doc_type`. Tên ràng buộc: `pk_*`, `uq_*`, `ck_*`, `fk_*`. `id` có Python default `uuid4` và server default `gen_random_uuid()`; `created_at`/`granted_at` có server default `now()`. Model: `backend/app/db/models.py`.

## auth_nonces
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| wallet | char(42) | lowercase |
| nonce | text UNIQUE | ngẫu nhiên |
| domain | text | = AUTH_DOMAIN |
| chain_id | bigint | |
| issued_at | timestamptz | |
| expires_at | timestamptz | issued_at + 5 phút |
| used_at | timestamptz NULL | consume bằng `UPDATE ... WHERE used_at IS NULL AND expires_at > now()` |

## sessions
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| wallet | char(42) | |
| token_hash | bytea UNIQUE | chỉ lưu hash token |
| created_at | timestamptz | |
| expires_at | timestamptz | TTL 20 phút |
| revoked_at | timestamptz NULL | logout |

## documents
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| uploader | char(42) | |
| token_id | numeric(78,0) NULL | null khi còn draft; đủ chứa uint256 |
| bind_tx_hash | char(66) NULL | |
| visibility | text | CHECK `IN ('public','private')` |
| doc_type | text | CHECK `IN ('certificate','image','metadata','invoice','incident_report','recall_reason')` |
| cid | text | |
| sha256 | bytea | hash byte gốc |
| mime_type, size_bytes | | |
| schema_version | int | |
| aad | bytea NULL | chỉ tài liệu riêng |
| wrapped_key, wrap_iv, wrap_tag | bytea NULL | data key bọc bằng MASTER_KEY |
| created_at | timestamptz | |

Index: `ix_documents_token_id (token_id)`, `ix_documents_uploader (uploader)`. Bind lặp cùng dữ liệu → cùng kết quả; bind sang lô khác → chặn.

## document_grants
| Cột | Kiểu | Ghi chú |
|---|---|---|
| document_id | uuid FK → documents | |
| wallet | char(42) | |
| granted_by | char(42) | phải là uploader |
| granted_at | timestamptz | |
| revoked_at | timestamptz NULL | |

PK `(document_id, wallet)`. Hệ quả: thu hồi rồi cấp lại cho cùng ví phải cập nhật dòng cũ (`revoked_at = NULL`), không chèn dòng mới. Nếu muốn giữ lịch sử từng lần cấp thì đổi sang PK `id` riêng + UNIQUE một phần `(document_id, wallet) WHERE revoked_at IS NULL` (chưa chốt).

## Quy tắc đọc tài liệu riêng
Phiên hợp lệ + vai trò on-chain còn hiệu lực + (grant chưa thu hồi hoặc là uploader). RPC lỗi → từ chối. Admin không tự grant cho mình.
Grant demo cho hóa đơn: Farmer A (uploader), Logistics, Retailer. Bị từ chối: Farmer B, Admin, Consumer.
