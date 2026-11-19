# COCOMARK frontend foundation

React 19, TypeScript and Vite 7. This repository currently contains the shared shell and route placeholders; business flows are intentionally pending.

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run lint
npm run typecheck
npm run build
```

Use Node 22 as set by the root `.nvmrc`. Fill public Vite settings in `.env.local`; do not put secrets in any `VITE_` value. `validateProductionConfig()` reports missing runtime settings. The development preview role selector is visible only under Vite development mode and never authorizes production access. Public trace routes require no wallet.

Shared imports: `components/ui` for fields, buttons and states; `components/common` for COCOMARK display pieces; `domain/types` for DTOs; `services/web3` and `services/http` for integration boundaries. See `docs/frontend/` for route and ownership details.
