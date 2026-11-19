# COCOMARK Figma Make read-only reference

This directory is a DESIGN REFERENCE snapshot of the COCOMARK prototype, not the production frontend. Code must be implemented in `frontend/` and should follow the project's production stack React 19 / TypeScript / Vite 7 / **plain CSS**. Do not import the demo reducer, fake hashes, or localStorage wallet authorization into production.

Reference Figma: https://www.figma.com/make/Vf0dEV7FcP0j5Ht5kcyXpO/COCOMARK

## Reference reading order
1. `COCOMARK_UI_UX_Spec.md` and `Kế hoạch.md`: functional requirements.
2. `COCOMARK_Guidelines.md`, `src/index.css`: tokens & typography.
3. `Primary.svg`: ONLY official logo, copy to `frontend/public/brand/Primary.svg`.
4. `src/components/layout/layout.tsx`: public header/footer, dashboard shell, sidebar labels.
5. `src/components/ui/index.tsx`, `src/components/ui/Icon.tsx`, `src/components/domain/basic.tsx`: component appearance and statuses.
6. `src/App.tsx`: source of 32 route patterns.
7. `src/pages/public/index.tsx`: product storytelling UI layout only, NOT production data flow.

## Visual identity
Be Vietnam Pro + JetBrains Mono; cocoa #463721, ivory #F8F8F0, forest #2D6A4F, forest-dark #235640, sage #D8E8D1, harvest #E8A75D, cream #FFF3E5, line #E6E1D3, danger #B42318.

Consumer's public pages: warm imagery and editorial storytelling. Operational dashboards: clean professional enterprise SaaS sidebar/table layout. Responsive mobile pages. Vietnamese labels. Preserve visually material design; do not copy simulated business behavior.

## Important
Prototype mock state, `fakeTx`, `fakeCid`, `simulateHash`, and fake wallet selection are NOT real blockchain security or data. In production contract/API integration they must be implemented by the right teams, not copied verbatim from the reference. Avoid falsely marking any on-chain data verified.
