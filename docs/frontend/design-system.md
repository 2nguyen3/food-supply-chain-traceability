# COCOMARK design system

Source: `docs/reference/figma-make/` and the UI/UX specification. Use the supplied `Primary.svg` as an image with the COCOMARK wordmark. Palette: cocoa `#463721`, ivory `#F8F8F0`, forest `#2D6A4F`, forest dark `#235640`, sage `#D8E8D1`, harvest `#E8A75D`, cream `#FFF3E5`, line `#E6E1D3`, danger `#B42318`. Type: Be Vietnam Pro; JetBrains Mono for identifiers. Spacing follows 8 px increments, controls use 12 px radii, cards 16 px.

```tsx
import { Button, Input, Card, PageHeader, EmptyState } from '../components/ui'
<PageHeader title="Lô của tôi" description="Các lô đã tạo" />
<Card><Input label="Mã lô" name="code" /><Button type="submit">Tra cứu</Button></Card>
<EmptyState title="Chưa có lô" />
```

Public header is 64 px and the dashboard sidebar/topbar are 250/72 px. Navigation collapses to menus on narrow screens. Keep visible focus, labels, 44 px touch targets, explicit loading/error/empty states and Vietnamese copy. Interface text must distinguish preview data from confirmed Sepolia data.
