# Frontend ownership

| Owner | Directories |
|---|---|
| Frontend Lead | `src/app`, `src/layouts`, `src/components/ui`, `src/components/common`, `src/domain`, `src/config`, `src/services` interfaces, `src/styles`, later `src/features/public` and `src/features/farmer` |
| Frontend 2 | `src/features/auth`, `src/features/admin` |
| Frontend 3 | `src/features/logistics`, `src/features/retailer`, `src/features/transfers` |

Feature owners can replace placeholders in their `routes.tsx` and add local files without editing the root router. Request review before changing shared types, components, services or layouts. FE2 can begin wallet challenge and Admin views. FE3 can begin Logistics and Retailer views and transfer screens. Neither should claim chain or API success before integration exists.
