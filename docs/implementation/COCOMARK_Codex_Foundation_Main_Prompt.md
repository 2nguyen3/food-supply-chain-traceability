# COCOMARK — CODEX TASK 01: FRONTEND FOUNDATION ON MAIN

You are the Frontend Lead for COCOMARK, an Ethereum Sepolia food traceability DApp. Implement ONLY the shared frontend foundation in the existing monorepo. Later, three developers will implement the business pages in parallel.

## REQUIRED: Start by inspecting the actual repo
- Project root: `food-supply-chain-traceability/`.
- Work on existing branch `main`, as explicitly requested. Do NOT create/switch branches. Check `git status` before changes, do not discard uncommitted work, never force-push, and do not commit or push automatically.
- Inspect `frontend/package.json`, lockfile, `src/`, Vite/TS config, root `.nvmrc`, root README, `backend/` and `contracts/` boundaries (read-only).
- Existing frontend is a React 19 + TypeScript + Vite 7 starter. Preserve the structure and locked major versions; do not scaffold a second Vite app, do not overwrite backend/contracts/iot.
- Read source-of-truth project requirements at `docs/reference/figma-make/Kế hoạch.md` (if present) and `docs/reference/figma-make/COCOMARK_UI_UX_Spec.md`. If not available, report exactly which references are missing and use the instructions here; do not invent features.

## DESIGN REQUIREMENT: MUST FOLLOW ACTUAL FIGMA MAKE COCOMARK
Figma URL: https://www.figma.com/make/Vf0dEV7FcP0j5Ht5kcyXpO/COCOMARK
- Before styling, inspect the OPTIONAL READ-ONLY exported source under `docs/reference/figma-make/`: `src/App.tsx`, `src/index.css`, `src/components/layout/layout.tsx`, `src/components/ui/index.tsx`, `src/components/ui/Icon.tsx`, `src/components/domain/basic.tsx`, `src/pages/public/index.tsx`, plus logo `Primary.svg` and `COCOMARK_Guidelines.md`.
- If your environment can read Figma Make directly, you may compare it; do not assume URL access. Local design-reference files take precedence over unverified visual guesses.
- Recreate the established COCOMARK visual language, do not invent another brand or theme:
  * Logo: copy original `Primary.svg` from reference into `frontend/public/brand/Primary.svg`; display as an image, never redraw or regenerate.
  * Fonts: Be Vietnam Pro (body/headings), JetBrains Mono (hashes/addresses).
  * CSS design tokens: cocoa `#463721`, ivory `#F8F8F0`, forest `#2D6A4F`, forest-dark `#235640`, sage `#D8E8D1`, harvest `#E8A75D`, cream `#FFF3E5`, line `#E6E1D3`, danger `#B42318`.
  * 8px spacing rhythm, 12–16px radii, subtle borders/shadows, strong focus states, clear statuses, Vietnamese interface text.
  * PublicLayout: sticky ivory header, authentic logo + wordmark, navigation `Trang chủ / Tra cứu lô`, wallet entry CTA, responsive mobile navigation; short professional footer with COCOMARK / Khám phá / Công nghệ.
  * DashboardLayout: left sidebar based on role, topbar, wallet/network status region, central content, responsive drawer/mobile menu. Follow the Figma menu labels/ordering, not a fresh layout.
  * No excessive "demo/prototype" badges or fake product claims. In development, distinguish mock state unobtrusively; never suggest fake CID/tx hashes are confirmed on chain.
- Styling for this production repository: use **plain CSS and CSS variables** as the project plan specifies; translate Figma Tailwind presentation into reusable CSS classes, do not install Tailwind just to copy mockup.

## IMPLEMENT ONLY THESE FOUNDATION DELIVERABLES

A. Project setup
- Keep existing React 19, TS and Vite 7; add `react-router-dom` compatible with installed dependencies; prefer `npm` and update `package-lock.json`.
- Add consistent `dev`, `build`, `typecheck`, `lint`, `preview` scripts, fix TS config as needed, sensible ESLint/Prettier formatting configuration (avoid unnecessary dependency churn).
- Add `frontend/.env.example` for public Vite variables: `VITE_CHAIN_ID=11155111`, `VITE_PUBLIC_RPC_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_API_BASE_URL`, `VITE_IPFS_GATEWAY`. Runtime validation should report missing production settings rather than fabricating addresses. No secrets in `VITE_` vars.

B. Shared CSS and components
- Create `src/styles/tokens.css`, `src/styles/global.css` and any minimal component styles.
- Build reusable, accessible UI components with typed props: `Button`, `Input`, `Textarea`, `Select`, `Card`, `Modal`, `ConfirmDialog`, `DataTable` or `Table`, `Badge`/`StatusBadge`, `Toast`, `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `Breadcrumb`.
- Create lightweight common domain display pieces: `Logo`, `WalletChip`, `NetworkBadge`, `LifecycleBadge`, `RecallBadge`, `ExpiryBadge` and optionally a neutral `BatchSummaryCard`; do not implement transactions or full business features here.
- Preserve keyboard focus, accessible label associations, modal close behavior and mobile responsiveness.

C. Layouts and route registry
- Create `PublicLayout`, `DashboardLayout`, `Sidebar`, `Topbar` and route error pages (403/404), styled like Figma.
- Register these EXACT 32 URL patterns plus a 404 catch-all:
  Public: `/`, `/trace`, `/trace/demo/:code`, `/trace/:chainId/:contractAddress/:tokenId`.
  Auth: `/connect`, `/auth/sign`, `/auth/network`, `/auth/no-access`.
  Admin: `/admin/overview`, `/admin/roles`, `/admin/farms`, `/admin/incidents`, `/admin/incidents/:id`, `/admin/batches`, `/admin/batches/:code`.
  Farmer: `/farmer/overview`, `/farmer/batches`, `/farmer/batches/:code`, `/farmer/create`, `/farmer/transfers`.
  Logistics: `/logistics/overview`, `/logistics/incoming`, `/logistics/batches`, `/logistics/batches/:code`, `/logistics/batches/:code/transit`, `/logistics/outgoing`.
  Retailer: `/retailer/overview`, `/retailer/incoming`, `/retailer/batches`, `/retailer/batches/:code`, `/retailer/sales`, `/retailer/incidents/new`.
- Add `/admin`, `/farmer`, `/logistics`, `/retailer` index redirects to their `/overview` routes (do not count redirects as pages).
- Use role-aware route guards; `Consumer` is public, NOT an on-chain role. A development-only mock session adapter can allow QA preview without backend; it must be clearly isolated and never accepted as production authorization.
- All unimplemented pages MUST be centralized lightweight placeholders using shared design components. They must display page title and intended owning feature, with no fake completed transaction logic. Make feature-owned route modules (`features/auth/routes.tsx`, etc.) so team members can replace placeholders in their own module without repeatedly editing the root router.

D. Shared domain and integrations — interfaces first, not fake implementations
- Define shared TypeScript models / DTO boundaries for `Role`, `Wallet`, `Batch`, `Lifecycle`, `TransferRequest`, `Incident`, `PrivateDocument`, `ChainEvent`, `Reading`, `TransactionStatus` and `ApiError`.
- Domain invariants: one batch = 1,000 kg = one ERC-721 NFT; lifecycle `Created -> InTransit -> Delivered -> Sold`; `recalled` separate from lifecycle; `expired` computed from expiration; pending transfer does NOT change ownership.
- Provide public read and signed-write Web3 service **interfaces** for Sepolia, wallet connection, chain and role reads, `createBatch`, `requestTransfer`, `acceptTransfer`, `markSold`, `recallBatch`; no fabricated successful on-chain transactions.
- Provide centralized typed HTTP client with base URL, error normalization, request cancellation and authorization token injection interface. Document planned FastAPI paths `/auth/challenge`, `/auth/verify`, `/auth/logout`, `/documents`, `/documents/:id/bind`, document content and grants; DO NOT claim backend is ready.
- Keep server auth token in memory in actual production flow. No private keys, seed phrases, Pinata tokens or AES keys in frontend or git.
- Place mock adapters in clearly named `src/mocks/`, isolated behind interfaces; use fixtures only for rendering. No fake transaction as real successful state.

E. Team boundaries and docs
- Team owners: Frontend Lead owns `src/app`, `src/layouts`, `src/components/ui`, `src/components/common`, `src/domain`, `src/config`, `src/services` interfaces, `src/styles` and later `src/features/public`, `src/features/farmer`.
- Frontend 2 later owns `src/features/auth`, `src/features/admin`.
- Frontend 3 later owns `src/features/logistics`, `src/features/retailer`, `src/features/transfers`.
- Create `frontend/README.md`, `docs/frontend/architecture.md`, `docs/frontend/routes.md`, `docs/frontend/ownership.md`, `docs/frontend/design-system.md` with all route names, component usage examples, and exact ownership. Ensure both teammates can work without modifying shared files unless reviewed.
- Do not modify project-wide README unless strictly necessary; do not modify backend/contracts/iot.

## NON-GOALS — STOP AT FOUNDATION
- Do NOT implement Public/Farmer final business pages yet; those are the Frontend Lead's next task.
- Do NOT build Auth/Admin/Logistics/Retailer business flows; other developers will own them.
- Do NOT import the Figma demo store/reducer or dummy CID/hash/transaction generator into production.
- Do NOT assert a wallet signature, API call, QR/IPFS, contract transaction, or ACL is real unless genuinely wired.
- Do NOT add email/password, registration, marketplace, shopping, split/merge batch or unrelated features.
- Do NOT switch branches, commit, push, open PRs or force-write remotely without explicit approval.

## VERIFY BEFORE REPORTING DONE
1. `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` must run successfully (if failure, fix and report actual outputs).
2. All 32 routes should resolve to the correct layouts and placeholder labels; redirects, 403 and 404 should work.
3. Check visual parity of header/footer, dashboard shell, mobile drawer, typography, logo and palette against read-only Figma reference.
4. Guard behavior must not treat mock role selection as blockchain authorization in production mode.
5. Ensure no `.env.local`, credentials or secrets are committed.
6. Report changed files, commands actually run, actual passing/failing results, known limitations, and precisely what FE2/FE3 can start implementing next.

Implement this on local `main` only, then STOP and ask me to review the result. Do not auto-commit or push.
