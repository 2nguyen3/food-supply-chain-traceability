# COCOMARK — UI/UX Product Specification
**Bản thiết kế đã chốt — 30/10/2026**  
**Nguồn nghiệp vụ:** `Kế hoạch.md` v2.2 Rev.04, 20/10/2026.  
**Trạng thái:** Đặc tả thiết kế/prototype; không khẳng định DApp, API, blockchain hoặc IPFS đã chạy thật.

## 1. Mục tiêu và phạm vi
COCOMARK là website/DApp quản lý **nguyên lô dừa nguyên trái** theo tuyến Farmer → Logistics → Retailer và cho Consumer truy xuất nguồn gốc bằng QR. **Mỗi lô luôn 1 tấn (1.000 kg) và tương ứng một NFT ERC-721**. Phần quản lý có đăng nhập ví, phân vai trò on-chain; phần truy xuất công khai không cần ví. Smart contract dự kiến triển khai Ethereum Sepolia; hồ sơ công khai trên IPFS; tài liệu riêng dùng AES-GCM/ACL ở backend; nhiệt độ do script Python/Web3.py từ CSV ghi lên chain.

Ngoài phạm vi: đặt hàng, thanh toán, marketplace, giỏ hàng, giao nhận theo phần khối lượng, chia/gộp lô, phần cứng IoT thật, đăng ký/đăng nhập email-mật khẩu, quản lý khách hàng, phân phối thêm một role Processing. Không hiển thị tính năng chưa chốt như thể đã triển khai.

## 2. Design system
- Logo: dùng **chính xác `Primary.svg` do người dùng cung cấp**, hình linh vật mặt tròn màu kem và viền nâu. Chỉ gắn wordmark COCOMARK bên cạnh; không vẽ lại hoặc thay logo.
- Phong cách: **Warm Agritech** cho thương hiệu; **Professional SaaS** cho Admin/Farmer/Logistics/Retailer; **Farm-to-Table Storytelling** cho Consumer.
- Màu chính: Cocoa `#463721`, Warm Ivory `#F8F8F0` (logo gốc). Bổ sung Forest Green `#2D6A4F`, Light Sage `#D8E8D1`, Harvest Orange `#E8A75D`, Soft Cream `#FFF3E5`; white `#FFFFFF`, neutrals cho bảng/tài liệu. Success/error/warning có text+icon, không dựa vào màu duy nhất.
- Typography: Be Vietnam Pro hoặc font hỗ trợ dấu tiếng Việt rõ; heading 28–36px, section 20–24px, body 14–16px, table ≥13px. Kỹ thuật: mono cho wallet, tx hash, CID.
- Dashboard desktop: sidebar 250px, topbar 72px, content max ~1280px, card radius 12–16, soft borders, table density vừa, filters/search. Mobile: sidebar drawer; ưu tiên Consumer trace ở 390px, desktop quản trị 1440px, tablet 768px.
- Components: AppShell, SideNav(role), WalletChip, NetworkBadge, RoleBadge, BatchCard, BatchTable, StatusBadge, ExpiryBadge, RecallBanner, LifecycleStepper, PendingTransferCard, HashVerificationPanel, FileCard/CIDChip, TxProgressDialog, TimelineEvent, OwnershipHistory, TemperatureChart, IncidentCard, EvidenceViewer, QRCard, Empty/Loading/ErrorState, Toast, ConfirmDialog, Breadcrumb, FilterBar.
- Trạng thái UX: loading, empty, error, wrong chain, not authorized, session expiry, disconnected, wallet signature rejected, transaction rejected/revert/pending/success, IPFS timeout/hash mismatch, missing batch, read-only RPC unavailable.

## 3. Phân quyền và route
**Consumer** được đọc trang trace mà không cần đăng nhập, ví hay token. Tất cả vai trò khác được nhận từ `hasRole` trên contract, không chọn role tùy ý.

**Public**
- Production trace reads RPC/events/IPFS directly; no backend login or PostgreSQL event cache is required for Consumer.
- `/` — Trang chủ thương hiệu, nhập mã lô và CTA tra cứu/kết nối ví.
- `/trace` — Trang nhập batchCode/tokenId, giải thích QR.
- `/trace/:chainId/:contractAddress/:tokenId` — URL chuẩn sản phẩm khi triển khai thật, đọc dữ liệu từ RPC/IPFS.
- `/trace/demo/:batchCode` — Route **chỉ dành cho prototype**, đọc fixtures, có nhãn `Dữ liệu mô phỏng`.

**Auth/Access**
- `/connect` — Kết nối MetaMask.
- `/auth/sign` — Chữ ký challenge/nonce.
- `/auth/network` — Sai mạng (Sepolia `11155111`), CTA chuyển mạng.
- `/auth/no-access` — Ví chưa được cấp quyền.

**Admin `/admin/...`**: overview; roles; farms; incidents; investigate-and-recall.

**Farmer `/farmer/...`**: overview; batches; create; batches/:id; transfers.

**Logistics `/logistics/...`**: overview; incoming; batches/:id/transit; outgoing.

**Retailer `/retailer/...`**: overview; incoming; batches; sales; incidents/new.

**Shared components/views**: tx-state, private document ACL, QR/export, provenance/ownership, feedback/error. Có thể là modal/tab/drawer dùng chung không bắt buộc route riêng.

### 3.1 Đăng nhập chuẩn
1. Vào `/`, nhấn `Kết nối ví` → MetaMask. Không có email/password hoặc form đăng ký role.
2. Nếu sai chain, hiển thị hướng dẫn chuyển Sepolia; không giả mạo tự đổi trạng thái chain.
3. Challenge từ `POST /auth/challenge`, người dùng ký message chứa purpose, nonce, domain, chainId, issuedAt, expirationTime; `POST /auth/verify` tạo Bearer token 20 phút cho tài liệu riêng. Prototype mô phỏng bước này, không thực sự ký nếu chưa tích hợp.
4. Đọc role on-chain bằng `hasRole`. Điều hướng Admin/Farmer/Logistics/Retailer. Một ví nhiều role có thể chọn **trong các role thực sự được cấp**. Không role → no-access.
5. Đổi account hoặc chain → xóa phiên trước, đóng modal chứa dữ liệu riêng, đọc lại role; không sử dụng role cached để quyết định quyền.
6. Phiên hết hạn: các trang public vẫn xem; đọc private doc yêu cầu ký lại.
7. **Demo-only controls:** control `Chuyển ví mô phỏng` trong một development drawer được gắn nhãn rõ, cho phép review flows không cần MetaMask thật. Không trình bày đây là tính năng authentication production.

### 3.2 RBAC theo tài liệu gốc
- Admin: cấp/thu hồi role, gán farmId, xem incident, truy ngược, `recallBatch`; **không mặc định xem hóa đơn riêng**.
- Farmer có farmId: `createBatch`, tạo public/private docs, `requestTransfer` Logistics, `cancelTransfer` lúc yêu cầu còn active, quản lý grants của tài liệu mình tải lên.
- Logistics được chỉ định: `acceptTransfer`/`rejectTransfer` từ Farmer sau khi xác minh 3 hash; giữ lô InTransit; readings từ Python/Web3.py; request/cancel giao Retailer.
- Retailer được chỉ định: accept/reject từ Logistics sau 3 hash; `markSold`, `reportIncident` ngay cả sau Sold.
- Consumer: xem lô, ảnh gốc, PDF chứng chỉ gốc, JSON metadata công khai, timeline, owner history, QR; không xem hóa đơn riêng.

## 4. Đề xuất 32 màn hình cốt lõi
| ID | Màn hình | Nội dung & tương tác |
|---|---|---|
| P01 | Landing | Hero dừa, logo, giới thiệu 3 bước, nhập batchCode, CTA tra cứu và kết nối ví, lợi ích, footer |
| P02 | Tra cứu | Ô nhập batchCode/tokenId, ví dụ, tìm kiếm, not-found/loading/RPC-error |
| P03 | Trace detail desktop | Ảnh lô, farmId/group, 1.000 kg, lifecycle+expired+recalled, timeline, owner NFT, 3 public docs, temp, tx links |
| P04 | Trace detail mobile | Biến thể full UX mobile cho QR, cảnh báo thu hồi nổi bật, chứng chỉ và lịch sử theo accordion |
| A01 | Connect | MetaMask, ví testnet, thông tin trước khi ký |
| A02 | Sign-in | Challenge nonce, chữ ký, trạng thái từ chối/thành công, phiên 20 phút |
| A03 | Wrong network | Sepolia chainId, button đổi mạng, trạng thái fail/retry |
| A04 | No access | Không được cấp role, địa chỉ ví, liên hệ Admin ngoài hệ thống, logout |
| AD01 | Admin overview | KPI: batches, roles, incidents, recalls; recent events, quick actions |
| AD02 | Role management | Tra cứu ví, cấp/thu hồi Farmer/Logistics/Retailer, modal xác nhận chain transaction, role history |
| AD03 | Farmer→farmId mapping | Bảng ví Farmer/farmId, gán hoặc thay mapping, trạng thái tx |
| AD04 | Incidents | Danh sách incident, token, reporter, thời gian, evidence CID, lọc trạng thái |
| AD05 | Investigation & recall | Incident detail, lineage FARM-A/HG-A01, related batches, so sánh đối chứng, chọn từng lô, lý do/CID, recall tx |
| F01 | Farmer overview | Lô của tôi, Pending/Created/transferred, nhanh tạo lô |
| F02 | Farmer batches | Table, filters, status, token, owner; đến detail |
| F03 | Create wizard | Step 1 batch data; Step 2 PDF+image public; Step 3 JSON metadata/hash/CID + private invoice; Step 4 review/sign `createBatch`; Step 5 receipt/minted NFT/QR |
| F04 | Farmer batch detail | 1.000 kg fixed, farm/group, tokenURI, proof, public docs, private invoice+grants, lifecycle, owner history |
| F05 | Farmer transfers | Request Logistics đúng role, pending requestId, cancel, history; owner không đổi trước accept |
| L01 | Logistics overview | Requests waiting, in-transit, temp alerts, quick links |
| L02 | Logistics incoming verify | Pending from Farmer, 3 checks metadata/PDF/image; accept only if all pass, reject permitted |
| L03 | In-transit detail | Lô sở hữu, temperature chart/5 readings, observedAt ≠ block time, locations, 18°C warning, tx refs |
| L04 | Logistics outgoing | Request to Retailer, cancel, see pending and accepted history |
| R01 | Retailer overview | Waiting verify, Delivered, Sold, incidents |
| R02 | Retailer incoming verify | Verify 3 raw-file hashes then `acceptTransfer`; show Delivered/owner change only after receipt |
| R03 | Retailer batches | List/details, docs, NFT owner, lifecycle, threshold readings, QR |
| R04 | Sold action/history | Confirm markSold on Delivered valid batch; keep NFT with Retailer, error cases disabled |
| R05 | Report incident | Fill observation, upload evidence JSON/PDF to IPFS, `reportIncident`, CID/txHash, permitted after Sold |
| S01 | Transaction state | `validating → awaiting signature → broadcast txHash → receipt pending → confirmed/failed`; retry/specific errors |
| S02 | Private documents | Invoice preview, ACL grants/revokes by authorized uploader, 403 for Admin/Farmer B/Consumer, AES-GCM wording only for design |
| S03 | QR viewer/export | QR linking trace, copy/open public URL, download QR image, demo vs real URL distinction |
| S04 | Provenance/NFT | CTE timeline vs distinct ERC-721 ownership timeline; tx links, event time, metadata URI |
| S05 | Status/error feedback | Empty, loading, not-found, RPC timeout, IPFS mismatch, wallet rejected, expired/recall banners |

## 5. Các màn hình trọng tâm cần vẽ kỹ
### 5.1 P03/P04 — Public trace
- Header logo, search, public status; hero photo of coconut batch, verified-data badge (chỉ khi hash đã kiểm), lifecycle, independent expired and recalled badges.
- Key info: batchCode, NFT tokenId, farmId, farmLocation, harvestGroupId, harvestDate, expiryDate, quantityKg=1000, cultivar/fertilizer, owner address short, metadata CID.
- Tabs/sections: Hành trình lô, Nhiệt độ vận chuyển, Lịch sử NFT, Hồ sơ công khai, Thông số & Blockchain.
- Public file cards: `certificate.pdf` **PDF gốc**, `batch.jpg` **ảnh gốc**, `metadata.json`; CID, separate SHA-256 status, open original gateway HTTPS/IPFS URI, download. Không thay PDF gốc bằng thumbnail hoặc chế ảnh.
- Timeline: BatchCreated, accepted transfers, TransitRecorded, BatchSold, IncidentReported, BatchRecalled. Không đếm `TransferAccepted` + ERC721 `Transfer` thành 2 lần bàn giao; ownership history riêng từ ERC-721 Transfer bao gồm mint zero-address.
- Each event includes truncated txHash, date, explorer link; in prototype, simulated links must be labelled and not pretend to be real Etherscan records.
- Recall banner persists even after Sold; no implication blockchain guarantees physical safety or actual certificate authenticity.

### 5.2 F03 — Create NFT wizard
- Step 1: batchCode, read-only farmId from Admin mapping, farmLocation, harvestGroupId, harvestDate, expiryDate, cultivar, fertilizer, thresholds. `quantityKg` locked at **1.000 kg**. Validate harvestDate ≤ now < expiryDate and unique code (mock validation only).
- Step 2: upload public PDF certificate and original batch image; simulate CID and bytes hash.
- Step 3: prepare public JSON metadata with image/CID/certificateURI/schemaVersion etc, hash exact bytes; show separate IPFS CIDs and SHA-256s; optionally upload **private wholesale invoice** via backend draft, labeled encrypted AES-GCM; never public plaintext IPFS.
- Step 4: review pre-mint, role/farmId/chain checks, request user sign `createBatch`; show S01 transaction progress.
- Step 5: only on confirmed receipt display `Token ID`, minted NFT, `tokenURI ipfs://...`, QR. If private upload draft exists, show bind after receipt; cannot bind to another token.

### 5.3 L02/R02 — Verify and accept
- Show `requestId`, from/to wallets, Batch/NFT data, pending tag, no owner change.
- Check metadata JSON bytes hash first against on-chain; only after success use verified JSON to resolve PDF/image and compare raw SHA-256. Three statuses: verifying / matches / mismatch or fetch error.
- Accept button disabled unless **all three passed** and wallet/role/pending request valid. `rejectTransfer` separate and allowed to close request.
- On receipt success update lifecycle InTransit for Logistics, Delivered for Retailer; owner and Transfer timeline. Error/revert never changes owner/status. Show explanatory note: successful hash comparison is **not** a guarantee of physical food quality.

### 5.4 L03 — IoT data
- Read-only on-chain `TransitRecorded` events produced by Python/Web3.py simulator, not actual device telemetry.
- Exactly five sample readings: 10°C, 12°C, 18°C, 13°C, 11°C; illustrative threshold 8–15°C from metadata. Flag 18°C as a **temperature excursion**, not automatic pathogen evidence.
- Columns: readingId, temp centi°C + human °C, observedAt (sensor simulation time), block timestamp, location, txHash.
- No front-end button falsely claiming to send records if no backend/script integration; may include clearly labelled **developer-only fixture loader** in prototype.

### 5.5 AD05 — Investigation and recall
- Start from Retailer incident of COCONUT-001. Show evidence CID/hash, incidentId, Blockchain tx, farmer, farmId, harvestGroupId.
- Related candidates by **same farmId AND same harvestGroupId**: COCONUT-002; distinguish COCONUT-003 (same farm, different group) and COCONUT-004 (different farm).
- Recall each batch separately via Admin with incidentId and reason CID/hash. No bulk auto-recall; no presumption that candidates are contaminated.
- Recall does not erase Sold or ownership history. Highlight these statuses independently on public QR.

## 6. Seed demo data — consistent across every screen
All records simulated for prototype only. Make every visible batch 1.000 kg and 1 NFT.
- `COCONUT-001`: FARM-A / HG-A01, had logistics temperature 18°C; **initially Sold**, NFT at Retailer, **not yet reported and not recalled**; Retailer can report incident after Sold; later Admin recalls.
- `COCONUT-002`: FARM-A / HG-A01; **initially Sold**, NFT at Retailer, not recalled; candidate related to 001, can still be recalled.
- `COCONUT-003`: FARM-A / HG-A02; **initially Delivered**, NFT at Retailer; control same farm, different harvest group; must not auto-recall.
- `COCONUT-004`: FARM-B / HG-B01; **initially Created**, NFT at Farmer B; control different farm; must not auto-recall.
- `COCONUT-005`: **created interactively in prototype** as new batch for live mint→transfer→verify→sold flow.
- Demo wallets: distinct labels `Admin`, `Farmer A`, `Farmer B`, `Logistics`, `Retailer`. Use obvious placeholders like `0xA1...D01` for visual UI only; these are not real Ethereum addresses or keys. `Consumer` has no wallet. No use of real seed phrase or test private key.
- Mock generated CIDs/hashes/transactions are **fixtures**. Show `Dữ liệu mô phỏng`, do not open fake hashes on Etherscan as if confirmed on Sepolia. Route `/trace/demo/:batchCode` inside preview; reserve canonical production QR `/trace/{chainId}/{contractAddress}/{tokenId}`.

## 7. Two end-to-end interactive demo flows
**Flow A — full role-to-role**
Landing → connect/select demo Farmer A → sign mock nonce → Farmer overview → create `COCONUT-005` fixed 1000kg → upload mock PDF/image/JSON → mint tx stages → confirmed NFT + QR → request Logistics (owner remains Farmer) → demo switch to Logistics → verify 3 hashes → accept tx → owner Logistics / InTransit → see fixture readings/temperature → request Retailer → switch Retailer → verify hashes → accept tx → owner Retailer / Delivered → markSold → public QR reflects Sold, NFT still Retailer.

**Flow B — incident & recall, main course demo**
Open Retailer COCONUT-001 → report incident with evidence mock IPFS → see event + incidentId → switch Admin → incident list → investigate source/ownership/temperature → candidates 001 and 002 only by matching FARM-A/HG-A01 → choose and recall **one at a time** with reason → public QR COCONUT-001/002 shows Sold+Recalled if Sold; 003/004 do not show Recalled.

**Flow C — access control**
Farmer A uploads private wholesale invoice and grants Logistics/Retailer; Logistics/Retailer with valid auth session may open; Farmer B and Admin without grant see 403; Consumer cannot see private invoice. Logout/expired session requires re-auth; revoke grant blocks future reads.

## 8. Component behavior and accessibility
- Global `Dữ liệu mô phỏng` badge in prototype, clearly separated from Sepolia connection badge.
- Every actionable control must work: navigate, search, filters, reset fixture, validation, modal open/close, table row detail, role simulation, request/reject/cancel/accept, markSold, incident, recall, open QR, view docs, copy mock CID/tx.
- Keep fixture state consistent across roles until user presses `Đặt lại dữ liệu demo`; refresh behavior is optional but disclose if not persistent.
- Per-action permission and precondition checks in UI; backend/contract remains final authority in production.
- At least basic keyboard focus, labels, errors under fields, contrast, no color-only feedback.
- Mobile consumer trace is mandatory; desktop 1440 wide role dashboards; responsive small-screen dashboard acceptable.
- All visible UX microcopy in Vietnamese, correct accents; keep only technical nouns e.g. MetaMask, CID, NFT, SHA-256, Sepolia, txHash.

## 9. Definition of done for Figma Make prototype
1. From landing, Consumer can search/open a trace **without wallet**.
2. From connect, demo wallet routes to its **real assigned** role (simulated hasRole), no freely selectable production role.
3. Each role has unique sidebar/menu and no unauthorized operations.
4. Create batch includes **exactly 1000 kg, 3 public IPFS file types, mint NFT** and credible transaction states.
5. Transfer request doesn't change owner; accept requires 3 checks; only confirmed receipt changes owner and lifecycle.
6. Logistics can see 5 CSV-sourced events, 18°C warning, sensor observed time vs chain time.
7. Retailer can Sold and report incident after Sold.
8. Admin investigation finds 001/002 candidates and explicitly excludes 003/004 from auto-recall; recall per-lot only.
9. Consumer trace shows both Sold and Recalled when appropriate; history separate from ownership ERC721; public original cert link works in mock preview or is transparently marked mock.
10. Document ACL lets granted Logistics/Retailer view private invoice, denies Admin/Farmer B/Consumer.
11. No fake claim of actual Sepolia/cryptography/IPFS operations in preview.
12. Layout usable at desktop (1440px) and mobile consumer (390px), using uploaded exact COCOMARK logo.
