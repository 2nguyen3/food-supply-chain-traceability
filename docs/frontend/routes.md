# Routes

All listed paths are registered. Each business view currently renders its title and owning feature as a placeholder.

| Area | URL patterns |
|---|---|
| Public | `/`, `/trace`, `/trace/demo/:code`, `/trace/:chainId/:contractAddress/:tokenId` |
| Auth | `/connect`, `/auth/sign`, `/auth/network`, `/auth/no-access` |
| Admin | `/admin/overview`, `/admin/roles`, `/admin/farms`, `/admin/incidents`, `/admin/incidents/:id`, `/admin/batches`, `/admin/batches/:code` |
| Farmer | `/farmer/overview`, `/farmer/batches`, `/farmer/batches/:code`, `/farmer/create`, `/farmer/transfers` |
| Logistics | `/logistics/overview`, `/logistics/incoming`, `/logistics/batches`, `/logistics/batches/:code`, `/logistics/batches/:code/transit`, `/logistics/outgoing` |
| Retailer | `/retailer/overview`, `/retailer/incoming`, `/retailer/batches`, `/retailer/batches/:code`, `/retailer/sales`, `/retailer/incidents/new` |

The four area roots redirect to `overview`. Unknown paths render 404. A connected wallet without the required role sees 403; disconnected dashboard visitors go to `/connect`; wrong-chain wallets go to `/auth/network`. Consumer routes are public.
