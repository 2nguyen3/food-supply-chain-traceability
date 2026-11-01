# Frontend architecture

`src/app/router.tsx` composes feature route arrays. Each owner replaces placeholders only inside their feature route module. `src/layouts` provides public and dashboard shells. `src/components/ui` holds general controls; `src/components/common` holds domain display pieces. `src/domain/types.ts` defines DTO boundaries and 1,000 kg invariants. `src/config/env.ts` validates production configuration.

`src/services/web3.ts` is interface-only. Integrations must obtain wallet connection, on-chain roles and transactions from Sepolia; a pending transfer does not change ownership. Recalled and expired are independent of lifecycle. The public reader must query chain/IPFS directly. `src/services/http.ts` normalizes HTTP errors, accepts `AbortSignal` through `RequestInit`, and injects memory-held bearer tokens. Planned FastAPI paths: `POST /auth/challenge`, `POST /auth/verify`, `POST /auth/logout`, `/documents`, `/documents/:id/bind`, document content and grants. These endpoints are not claimed ready.

`src/mocks/session.ts` exists only for development preview. Production authorization must verify `hasRole` on chain and reset on account or chain changes. Never treat preview roles as ACL, and never store auth tokens in local storage.
