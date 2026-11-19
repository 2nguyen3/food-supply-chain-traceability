# COCOMARK — Figma Make Guidelines

## Identity and style
- Use exact supplied `Primary.svg` mascot logo; do not redraw or generate an alternative.
- Consumer design: warm, human, editorial coconut product origin storytelling; dashboard design: precise, readable enterprise SaaS.
- Tokens: cocoa #463721, ivory #F8F8F0 (from logo), green #2D6A4F, sage #D8E8D1, orange #E8A75D, pale cream #FFF3E5.
- Typography Be Vietnam Pro; 8px spacing system; 12–16px rounded corners; subtle borders/shadows; accessible contrast; responsive components.
- All UI copy in Vietnamese with correct diacritics. Keep technical IDs and terms unlocalized.

## Product boundaries and trust
- Original project plan is `Kế hoạch.md` v2.2 Rev.04; detailed requirements are in `COCOMARK_UI_UX_Spec.md`.
- Only coconut traceability: 1 batch = 1000kg = 1 ERC721 NFT; Farmer→Logistics→Retailer→Consumer public trace.
- Don't add marketplace, purchases, payment, registration, email/password, IoT hardware or split/merge batch features.
- Role is assigned by on-chain permissions, not user choice; prototype may include explicitly labelled demo wallet switch control.
- Consumers require no wallet and should never see private wholesale invoices.
- Lifecycle Created→InTransit→Delivered→Sold. Expired is computed. Recalled is independent and may coexist with Sold.
- No state changes until mock transaction receipt confirmed; pending transfer doesn't change owner.
- Three raw-file hashes must pass before accept; private file ACL must deny Admin without grant.
- All mock chain/IPFS/cryptography data must be labelled `Dữ liệu mô phỏng`, not falsely claimed as Sepolia transactions or verification.

## Code and interaction
- Use structured routes, shared layout and components, a single mock data store and role-driven navigation.
- Prefer React + TypeScript with maintainable component organization; when feasible use plain CSS matching intended Vite codebase. Do not hardcode secrets.
- Each click target should navigate or perform a clearly documented prototype action. Implement inputs, validation, loading, denied, success/fail states.
- Core interactions: batch create/NFT, request/accept/reject/cancel, temperature history, markSold, incident, recall, QR, docs and ACL.
- Mobile Consumer trace at 390px must be treated as a first-class design, not shrunk desktop.
- Keep user-visible false claims out: no assertion of certified food safety or proof of contamination based only on a temperature excursion.
