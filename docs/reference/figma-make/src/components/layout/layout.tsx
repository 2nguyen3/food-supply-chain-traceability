import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { RoleKey } from '../../types'
import { useStore } from '../../store'
import { Button, Icon, Toasts, ErrorState, type IconName, Modal } from '../ui'
import { Logo, NetworkBadge, RoleBadge, WalletChip } from '../domain/basic'
import { fmtDateTime } from '../../lib/format'
import { activeRequest } from '../../store/rules'

export const roleHome = (r: RoleKey) => `/${r}/overview`

const NAV: Record<RoleKey, { to: string; label: string; icon: IconName }[]> = {
  admin: [
    { to: '/admin/overview', label: 'Tổng quan', icon: 'home' },
    { to: '/admin/roles', label: 'Vai trò & quyền', icon: 'users' },
    { to: '/admin/farms', label: 'Farmer ↔ farmId', icon: 'map' },
    { to: '/admin/incidents', label: 'Sự cố & thu hồi', icon: 'flag' },
    { to: '/admin/batches', label: 'Tất cả lô', icon: 'box' },
  ],
  farmer: [
    { to: '/farmer/overview', label: 'Tổng quan', icon: 'home' },
    { to: '/farmer/batches', label: 'Lô của tôi', icon: 'box' },
    { to: '/farmer/create', label: 'Tạo lô NFT', icon: 'plus' },
    { to: '/farmer/transfers', label: 'Chuyển giao', icon: 'route' },
  ],
  logistics: [
    { to: '/logistics/overview', label: 'Tổng quan', icon: 'home' },
    { to: '/logistics/incoming', label: 'Yêu cầu nhận lô', icon: 'download' },
    { to: '/logistics/batches', label: 'Lô đang vận chuyển', icon: 'truck' },
    { to: '/logistics/outgoing', label: 'Giao cho Retailer', icon: 'route' },
  ],
  retailer: [
    { to: '/retailer/overview', label: 'Tổng quan', icon: 'home' },
    { to: '/retailer/incoming', label: 'Yêu cầu nhận lô', icon: 'download' },
    { to: '/retailer/batches', label: 'Lô quản lý', icon: 'box' },
    { to: '/retailer/sales', label: 'Đánh dấu đã bán', icon: 'store' },
    { to: '/retailer/incidents/new', label: 'Báo cáo sự cố', icon: 'flag' },
  ],
}

export function EnvInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Thông tin môi trường" footer={<Button onClick={onClose}>Đóng</Button>}>
      <ul className="list-disc space-y-2 pl-5 text-sm text-cocoa-soft">
        <li>Phiên bản này dùng dữ liệu Blockchain và IPFS mô phỏng; không kết nối Sepolia, không mint NFT, không tải IPFS và không mã hóa tài liệu thật.</li>
        <li>CID, SHA-256 và txHash hiển thị là giá trị tạo sẵn, không phải bản ghi đã xác nhận trên chuỗi.</li>
        <li>Trạng thái nghiệp vụ lưu trong trình duyệt này, không chia sẻ giữa thiết bị hoặc trình duyệt khác. Dùng nút Demo để chuyển ví hoặc đặt lại dữ liệu.</li>
        <li>Khớp hash không chứng minh an toàn thực phẩm.</li>
      </ul>
    </Modal>
  )
}

/* ---------- Public ---------- */
export function PublicLayout() {
  const { actor } = useStore()
  const [open, setOpen] = useState(false)
  const [env, setEnv] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const links = [{ to: '/', label: 'Trang chủ' }, { to: '/trace', label: 'Tra cứu lô' }]
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo size={36} />
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-sage text-forest-dark' : 'hover:bg-sage/50'}`}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            {actor?.role ? (
              <Link to={roleHome(actor.role)}><span className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-dark"><Icon name="home" />Vào bảng điều khiển {actor.label}</span></Link>
            ) : (
              <Link to="/connect"><span className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-dark"><Icon name="wallet" />Kết nối ví</span></Link>
            )}
          </div>
          <button className="ml-auto rounded-lg p-2 hover:bg-sage/50 md:hidden" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} className="size-6" /></button>
        </div>
        {open && (
          <div className="animate-rise border-t border-line bg-ivory px-4 py-3 md:hidden">
            <nav className="grid gap-1" aria-label="Menu di động">
              {links.map((l) => <NavLink key={l.to} to={l.to} end className="rounded-lg px-3 py-2.5 font-semibold hover:bg-sage/50">{l.label}</NavLink>)}
              <NavLink to={actor?.role ? roleHome(actor.role) : '/connect'} className="rounded-lg px-3 py-2.5 font-semibold text-forest">{actor?.role ? `Bảng điều khiển ${actor.label}` : 'Kết nối ví'}</NavLink>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line bg-cocoa text-ivory/85">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div><Logo light size={36} /><p className="mt-4 max-w-xs text-sm text-ivory/70">Nền tảng truy xuất nguồn gốc dừa, kết nối minh bạch hành trình từ nông trại đến người tiêu dùng.</p></div>
          <nav aria-label="Khám phá"><p className="mb-3 text-sm font-semibold text-ivory">Khám phá</p><ul className="space-y-2 text-sm text-ivory/70"><li><Link to="/" className="hover:text-ivory">Trang chủ</Link></li><li><Link to="/trace" className="hover:text-ivory">Truy xuất nguồn gốc</Link></li><li><Link to="/connect" className="hover:text-ivory">Kết nối ví</Link></li></ul></nav>
          <div><p className="mb-3 text-sm font-semibold text-ivory">Công nghệ</p><ul className="space-y-2 text-sm text-ivory/70"><li>Blockchain</li><li>NFT ERC-721</li><li>IPFS</li><li>Mã QR truy xuất</li></ul></div>
        </div>
        <div className="border-t border-ivory/10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ivory/60 sm:px-6"><span>© 2026 COCOMARK</span><button onClick={() => setEnv(true)} className="underline-offset-2 hover:text-ivory hover:underline">Thông tin môi trường</button></div></div>
      </footer>
      <EnvInfoModal open={env} onClose={() => setEnv(false)} />
    </div>
  )
}

/* ---------- Dashboard ---------- */
export function RequireRole({ role }: { role: RoleKey }) {
  const { actor, state } = useStore()
  if (!actor) return <Navigate to="/connect" replace />
  if (state.sim.wrongChain) return <Navigate to="/auth/network" replace />
  if (!actor.role) return <Navigate to="/auth/no-access" replace />
  return <AppShell role={role} allowed={actor.role === role} />
}

function Sidebar({ role, onNavigate }: { role: RoleKey; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-[72px] items-center border-b border-line px-5"><Logo size={36} to={roleHome(role)} /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Điều hướng vai trò">
        {NAV[role].map((n) => (
          <NavLink key={n.to} to={n.to} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-sage text-forest-dark' : 'text-cocoa-soft hover:bg-ivory hover:text-cocoa'}`}>
            <Icon name={n.icon} className="size-[18px]" />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line p-4 pb-20 text-xs text-cocoa-soft">
        <Link to="/trace" className="flex items-center gap-2 font-semibold hover:text-forest"><Icon name="search" />Mở trang tra cứu công khai</Link>
      </div>
    </div>
  )
}

function Bell() {
  const { state, actor } = useStore()
  const [open, setOpen] = useState(false)
  const items: { text: string; to: string }[] = []
  if (actor?.role === 'logistics' || actor?.role === 'retailer') {
    state.requests.filter((r) => r.status === 'pending' && r.to === actor.id).forEach((r) => items.push({ text: `Yêu cầu ${r.id} đang chờ bạn xác minh và chấp nhận (token #${r.tokenId})`, to: `/${actor.role}/incoming` }))
  }
  if (actor?.role === 'farmer' || actor?.role === 'logistics') {
    state.requests.filter((r) => r.from === actor.id && (r.status === 'rejected' || r.status === 'accepted')).slice(-3).forEach((r) => items.push({ text: `Yêu cầu ${r.id} đã được ${r.status === 'accepted' ? 'chấp nhận' : 'từ chối'}`, to: actor.role === 'farmer' ? '/farmer/transfers' : '/logistics/outgoing' }))
  }
  if (actor?.role === 'admin') {
    state.incidents.filter((i) => !state.batches.find((b) => b.tokenId === i.tokenId)?.recalled).forEach((i) => items.push({ text: `Sự cố ${i.id} chưa xử lý thu hồi`, to: `/admin/incidents/${i.id}` }))
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label={`Thông báo (${items.length})`} aria-expanded={open} className="relative rounded-xl border border-line p-2.5 hover:bg-ivory">
        <Icon name="bell" className="size-5" />
        {items.length > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-danger text-[11px] font-bold text-white">{items.length}</span>}
      </button>
      {open && (
        <div className="animate-pop absolute right-0 top-12 z-40 w-80 rounded-2xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold text-cocoa-soft">Thông báo</p>
          {items.length === 0 && <p className="px-3 pb-3 text-sm text-cocoa-soft">Không có thông báo mới.</p>}
          {items.map((i, k) => <Link key={k} to={i.to} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-ivory">{i.text}</Link>)}
        </div>
      )}
    </div>
  )
}

function AppShell({ role, allowed }: { role: RoleKey; allowed: boolean }) {
  const { actor, dispatch, state, toast } = useStore()
  const [drawer, setDrawer] = useState(false)
  const [out, setOut] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(() => setDrawer(false), [loc.pathname])
  return (
    <div className="min-h-screen bg-ivory lg:pl-[250px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-line lg:block"><Sidebar role={role} /></aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-cocoa/50" onClick={() => setDrawer(false)} />
          <aside className="animate-rise absolute inset-y-0 left-0 w-[270px] shadow-2xl"><Sidebar role={role} onNavigate={() => setDrawer(false)} /></aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
        <button className="rounded-xl border border-line p-2.5 lg:hidden" aria-label="Mở menu điều hướng" onClick={() => setDrawer(true)}><Icon name="menu" className="size-5" /></button>
        <RoleBadge role={actor?.role ?? null} />
        <div className="hidden sm:block"><WalletChip wallet={actor} /></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:block"><NetworkBadge wrong={state.sim.wrongChain} /></span>
          <Bell />
          <Button variant="secondary" size="sm" icon="logout" onClick={() => setOut(true)}><span className="hidden sm:inline">Đăng xuất</span></Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8">
        {allowed ? <Outlet /> : <ErrorState title="403 - Không có quyền truy cập" desc={`Ví ${actor?.label} có role ${actor?.role}, không được xem khu vực ${role}. Quyền được xác định bởi hasRole trên hợp đồng, không thể tự chọn.`} action={<Button onClick={() => nav(roleHome(actor!.role!))}>Về bảng điều khiển của tôi</Button>} />}
      </main>
      <ConfirmLogout open={out} onClose={() => setOut(false)} onOk={() => { dispatch({ type: 'logout' }); toast('Đã đăng xuất', 'info'); nav('/') }} />
    </div>
  )
}
function ConfirmLogout({ open, onClose, onOk }: { open: boolean; onClose: () => void; onOk: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Đăng xuất / đổi ví" footer={<><Button variant="secondary" onClick={onClose}>Ở lại</Button><Button onClick={() => { onClose(); onOk() }}>Đăng xuất</Button></>}>
      <p className="text-sm text-cocoa-soft">Phiên hiện tại và phiên đọc tài liệu riêng sẽ bị xóa. Role được đọc lại khi bạn kết nối ví khác.</p>
    </Modal>
  )
}

/* ---------- Demo drawer ---------- */
export function DemoDrawer() {
  const { state, dispatch, demoOpen, setDemoOpen, actor, persisted, now, expireDocSession, toast } = useStore()
  const nav = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const sw = (id: string | null) => {
    if (!id) { dispatch({ type: 'logout' }); nav('/trace'); setDemoOpen(false); return }
    const w = state.wallets.find((x) => x.id === id)!
    dispatch({ type: 'login', walletId: id })
    dispatch({ type: 'setSim', patch: { wrongChain: false } })
    nav(w.role ? roleHome(w.role) : '/auth/no-access')
    setDemoOpen(false)
    toast(`Đã chuyển sang ví mô phỏng ${w.label} (bỏ qua bước ký, chỉ để demo)`, 'info')
  }
  const sel = 'h-9 w-full rounded-lg border border-line bg-white px-2 text-sm'
  return (
    <>
      <button onClick={() => setDemoOpen(true)} className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-harvest bg-cocoa px-4 py-2.5 text-sm font-bold text-ivory shadow-lg hover:brightness-110" aria-label="Mở bảng điều khiển demo">
        <Icon name="sliders" />Demo
      </button>
      {demoOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-cocoa/40" onClick={() => setDemoOpen(false)} />
          <aside role="dialog" aria-label="Bảng điều khiển demo" className="animate-rise absolute inset-y-0 left-0 flex w-[min(92vw,380px)] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-cocoa px-5 py-4 text-ivory">
              <div><p className="font-bold">Bảng điều khiển demo</p><p className="text-xs text-ivory/70">Chỉ dành cho demo/nhà phát triển. Không phải tính năng đăng nhập thật.</p></div>
              <button onClick={() => setDemoOpen(false)} aria-label="Đóng"><Icon name="x" className="size-5" /></button>
            </div>
            <div className="space-y-6 p-5 text-sm">
              <section>
                <h3 className="mb-2 text-sm">Chuyển ví mô phỏng</h3>
                <p className="mb-2 text-xs text-cocoa-soft">Địa chỉ giả, không có khóa riêng. Role của mỗi ví do bảng role mô phỏng quyết định (Admin có thể đổi).</p>
                <div className="grid gap-1.5">
                  {state.wallets.map((w) => (
                    <button key={w.id} onClick={() => sw(w.id)} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left hover:bg-ivory ${actor?.id === w.id ? 'border-forest bg-sage/50' : 'border-line'}`}>
                      <span className="font-semibold">{w.label}</span><RoleBadge role={w.role} />
                    </button>
                  ))}
                  <button onClick={() => sw(null)} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left hover:bg-ivory ${!actor ? 'border-forest bg-sage/50' : 'border-line'}`}><span className="font-semibold">Consumer (không ví)</span><span className="text-xs text-cocoa-soft">chỉ đọc</span></button>
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm">Mô phỏng lỗi và điều kiện</h3>
                <label className="block text-xs font-semibold">Giao dịch kế tiếp
                  <select className={sel + ' mt-1'} value={state.sim.failTx} onChange={(e) => dispatch({ type: 'setSim', patch: { failTx: e.target.value as never } })}>
                    <option value="none">Thành công</option><option value="reject">Từ chối chữ ký</option><option value="revert">Bị revert</option><option value="timeout">Hết thời gian chờ biên nhận</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">Hash không khớp ở tệp
                  <select className={sel + ' mt-1'} value={state.sim.hashFail} onChange={(e) => dispatch({ type: 'setSim', patch: { hashFail: e.target.value as never } })}>
                    <option value="none">Không có</option><option value="metadata">metadata.json</option><option value="certificate">certificate.pdf</option><option value="image">batch.jpg</option>
                  </select>
                </label>
                {([['ipfsDown', 'IPFS không khả dụng'], ['rpcDown', 'RPC không khả dụng (trang tra cứu)'], ['wrongChain', 'Ví đang ở sai mạng']] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" className="size-4 accent-[#2d6a4f]" checked={state.sim[k]} onChange={(e) => dispatch({ type: 'setSim', patch: { [k]: e.target.checked } })} />{l}</label>
                ))}
              </section>
              <section className="space-y-2">
                <h3 className="text-sm">Đồng hồ demo</h3>
                <p className="text-xs text-cocoa-soft">Hiện tại: {fmtDateTime(now)} (đã tiến {state.days} ngày). Dùng để thử trạng thái Hết hạn.</p>
                <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'advanceDays', n: 30 })}>+30 ngày</Button><Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'advanceDays', n: 90 })}>+90 ngày</Button></div>
                <Button size="sm" variant="secondary" icon="clock" onClick={() => { expireDocSession(); toast('Đã mô phỏng hết hạn phiên đọc tài liệu riêng', 'info') }}>Mô phỏng hết hạn phiên tài liệu</Button>
              </section>
              <section className="space-y-2">
                <Button variant="danger" icon="refresh" onClick={() => setConfirm(true)}>Đặt lại dữ liệu demo</Button>
                <button onClick={() => setEnvOpen(true)} className="text-xs font-semibold text-forest underline">Thông tin môi trường</button>
                <p className="text-xs text-cocoa-soft">{persisted ? 'Dữ liệu mô phỏng không nhạy cảm được lưu trong localStorage của trình duyệt này, nên tải lại trang không mất tiến trình. Không lưu khóa, token hay phiên ký.' : 'Trình duyệt không cho lưu trữ: dữ liệu chỉ nằm trong bộ nhớ và sẽ mất khi tải lại.'} Không chia sẻ giữa thiết bị hay trình duyệt khác.</p>
              </section>
            </div>
          </aside>
        </div>
      )}
      <EnvInfoModal open={envOpen} onClose={() => setEnvOpen(false)} />
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Đặt lại dữ liệu demo?" footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Hủy</Button><Button variant="danger" onClick={() => { dispatch({ type: 'reset' }); setConfirm(false); setDemoOpen(false); toast('Đã nạp lại 4 lô mẫu ban đầu', 'info'); nav('/') }}>Đặt lại</Button></>}>
        <p className="text-sm text-cocoa-soft">Mọi lô, yêu cầu chuyển, sự cố, thu hồi và quyền tài liệu bạn đã tạo sẽ bị xóa; COCONUT-001 đến 004 trở về trạng thái ban đầu.</p>
      </Modal>
    </>
  )
}

export function Root({ children }: { children?: ReactNode }) {
  return <><Outlet />{children}<DemoDrawer /><Toasts /></>
}
export { activeRequest }
