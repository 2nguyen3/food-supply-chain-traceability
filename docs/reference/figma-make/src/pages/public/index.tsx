import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store'
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Notice, Tabs, type IconName } from '../ui-barrel'
import { BatchBadges, KV, LifecycleStepper, OwnerChip, RecallBanner, IPFSCIDChip } from '../../components/domain/basic'
import { CertificatePreview, FileCard, NFTTransferHistory, QRCard, ReadingsTable, TemperatureChart, Timeline } from '../../components/domain/data'
import { PHOTOS } from '../../data/seed'
import { fmtDate } from '../../lib/format'
import { getBatchByCode, isExpired } from '../../store/rules'

const EXAMPLES = ['COCONUT-001', 'COCONUT-002', 'COCONUT-003', 'COCONUT-004']

function SearchBox({ big, dark }: { big?: boolean; dark?: boolean }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); nav(`/trace?q=${encodeURIComponent(q.trim())}`) }
  return (
    <form onSubmit={submit} className="w-full" role="search" aria-label="Tra cứu lô">
      <label htmlFor="trace-q" className="sr-only">Mã lô hoặc tokenId</label>
      <div className={`flex gap-2 rounded-2xl bg-white p-2 shadow-lg ${big ? '' : 'border border-line'}`}>
        <div className="flex flex-1 items-center gap-2 px-3"><Icon name="search" className="size-5 text-cocoa-soft" />
          <input id="trace-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập mã lô, ví dụ COCONUT-001" className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-[#a79b88]" /></div>
        <Button size="lg" type="submit" className={dark ? '' : ''}>Tra cứu</Button>
      </div>
    </form>
  )
}

export function Landing() {
  const { actor } = useStore()
  return (
    <div>
      <section className="relative isolate overflow-hidden bg-cocoa">
        <img src={PHOTOS.hero} alt="Vườn dừa xanh dưới bầu trời quang" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-cocoa via-cocoa/70 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-32">
          <div className="max-w-2xl animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-ivory/15 px-3 py-1 text-xs font-semibold text-ivory ring-1 ring-ivory/30"><Icon name="leaf" className="size-3.5" />Dừa tươi nguyên lô · Truy xuất bằng blockchain</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] text-ivory sm:text-5xl md:text-6xl">Mỗi lô dừa,<br />một câu chuyện <span className="text-harvest">minh bạch</span>.</h1>
            <p className="mt-5 max-w-xl text-lg text-ivory/85">Quét mã QR để biết lô dừa đến từ vườn nào, đi qua những ai, nhiệt độ vận chuyển ra sao và hồ sơ gốc ở đâu. Không cần ví, không cần đăng nhập.</p>
            <div className="mt-8 max-w-xl"><SearchBox big dark /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ivory/80">Thử ngay:{EXAMPLES.slice(0, 3).map((e) => <Link key={e} to={`/trace/demo/${e}`} className="rounded-full bg-ivory/15 px-3 py-1 font-mono text-xs text-ivory hover:bg-ivory/25">{e}</Link>)}</div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={actor?.role ? `/${actor.role}/overview` : '/connect'}><span className="inline-flex h-12 items-center gap-2 rounded-xl bg-harvest px-6 font-semibold text-cocoa hover:brightness-95"><Icon name="wallet" />{actor?.role ? 'Vào bảng điều khiển' : 'Kết nối ví để quản lý lô'}</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl"><p className="text-sm font-bold uppercase tracking-widest text-forest">Hành trình của một lô</p><h2 className="mt-2 text-3xl">Ba chặng, một sổ cái chung</h2></div>
        <div className="grid gap-5 md:grid-cols-3">
          {([['leaf', 'Nông trại tạo lô', 'Farmer ghi 1.000 kg dừa thành một NFT, đính kèm chứng chỉ PDF, ảnh gốc và metadata công khai.'], ['truck', 'Vận chuyển có kiểm chứng', 'Logistics đối chiếu 3 hash trước khi nhận. Nhiệt độ trên đường đi được ghi lại theo từng bản ghi.'], ['store', 'Bán lẻ và truy xuất', 'Retailer nhận, bán và có thể báo sự cố. Người tiêu dùng quét QR để xem toàn bộ.']] as [IconName, string, string][]).map(([ic, t, d], i) => (
            <Card key={t} className="relative">
              <span className="absolute right-5 top-4 text-5xl font-black text-sage">{i + 1}</span>
              <span className="grid size-12 place-items-center rounded-2xl bg-sage text-forest"><Icon name={ic} className="size-6" /></span>
              <h3 className="mt-4 text-lg">{t}</h3><p className="mt-1 text-sm text-cocoa-soft">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-cream">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <img src={PHOTOS.hang} alt="Buồng dừa xiêm xanh trên cây" className="h-72 w-full rounded-2xl object-cover" loading="lazy" />
            <img src={PHOTOS.farm} alt="Hàng dừa trên cánh đồng xanh" className="mt-8 h-72 w-full rounded-2xl object-cover" loading="lazy" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-harvest-dark">Từ vườn dừa Bến Tre</p>
            <h2 className="mt-2 text-3xl">Biết rõ vườn nào, nhóm thu hoạch nào</h2>
            <p className="mt-3 text-cocoa-soft">Mỗi lô gắn với mã trang trại (farmId) và nhóm thu hoạch (harvestGroupId). Khi có sự cố, quản trị viên có thể truy ngược các lô liên quan để điều tra, mà không thu hồi hàng loạt một cách mù quáng.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {['1 lô = 1.000 kg = 1 NFT ERC-721', 'Chứng chỉ PDF, ảnh và metadata gốc kèm CID và SHA-256', 'Trạng thái Hết hạn và Đã thu hồi luôn hiển thị rõ ràng'].map((x) => <li key={x} className="flex items-center gap-2"><Icon name="check" className="size-4 text-forest" strokeWidth={3} />{x}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-forest">Hồ sơ công khai</p>
          <h2 className="mt-2 text-3xl">Chứng chỉ gốc, không phải ảnh chụp lại</h2>
          <p className="mt-3 text-cocoa-soft">Bạn có thể mở bản PDF gốc, ảnh gốc và JSON metadata. Mỗi tệp có CID và SHA-256 riêng để đối chiếu. Hash khớp cho biết tệp không bị thay đổi, không thay thế kiểm định an toàn thực phẩm.</p>
          <div className="mt-5 flex gap-3"><Link to="/trace/demo/COCONUT-001"><span className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-5 font-semibold text-white hover:bg-forest-dark">Xem lô mẫu <Icon name="arrow" /></span></Link></div>
        </div>
        <div className="rotate-1"><CertificatePreview batch={useStore().state.batches[0]} /></div>
      </section>

      <section className="bg-forest text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <div><h2 className="text-2xl text-white">Bạn là nông hộ, đơn vị vận chuyển hay nhà bán lẻ?</h2><p className="text-white/80">Quyền truy cập do Admin cấp trên hợp đồng; không có đăng ký tự do hay email/mật khẩu.</p></div>
          <Link to="/connect"><span className="inline-flex h-12 items-center gap-2 rounded-xl bg-harvest px-6 font-semibold text-cocoa">Kết nối ví <Icon name="arrow" /></span></Link>
        </div>
      </section>
    </div>
  )
}

export function TraceSearch() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search))
  const q = (params.get('q') ?? '').trim()
  const [loading, setLoading] = useState(!!q)
  const [input, setInput] = useState(q)
  useEffect(() => {
    if (!q) return
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [q, state.sim.rpcDown])
  const found = q ? (getBatchByCode(state, q) ?? state.batches.find((b) => String(b.tokenId) === q.replace('#', ''))) : undefined
  const submit = (e: FormEvent) => { e.preventDefault(); const p = new URLSearchParams({ q: input.trim() }); setParams(p); window.history.replaceState(null, '', `/trace?${p}`) }
  useEffect(() => { if (found && !loading && !state.sim.rpcDown && q) nav(`/trace/demo/${found.code}`, { replace: true }) }, [found, loading]) // eslint-disable-line
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-forest">Tra cứu công khai</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">Nhập mã lô hoặc quét QR</h1>
      <p className="mt-2 text-cocoa-soft">Nhập batchCode (ví dụ COCONUT-001) hoặc tokenId. Không cần ví hay đăng nhập. Mã QR trên bao bì dẫn thẳng tới trang truy xuất của lô.</p>
      <form onSubmit={submit} className="mt-6 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Mã lô hoặc tokenId</label>
        <input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="COCONUT-001 hoặc 1" className="h-12 flex-1 rounded-xl border border-line bg-white px-4 text-base" />
        <Button size="lg" type="submit" icon="search">Tra cứu</Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-cocoa-soft">Ví dụ:</span>{EXAMPLES.map((e) => <Link key={e} to={`/trace/demo/${e}`} className="rounded-full border border-line bg-white px-3 py-1 font-mono text-xs hover:bg-sage/50">{e}</Link>)}</div>
      <div className="mt-8">
        {q && loading && <LoadingState label="Đang đọc dữ liệu lô…" />}
        {q && !loading && state.sim.rpcDown && <ErrorState title="Không kết nối được RPC / IPFS" desc="Dịch vụ đọc dữ liệu công khai tạm thời không khả dụng. Vui lòng thử lại sau." action={<div className="flex gap-2"><Button icon="refresh" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600) }}>Thử lại</Button><Button variant="secondary" onClick={() => dispatch({ type: 'setSim', patch: { rpcDown: false } })}>Tắt lỗi mô phỏng</Button></div>} />}
        {q && !loading && !state.sim.rpcDown && !found && <ErrorState tone="warn" title={`Không tìm thấy lô "${q}"`} desc="Kiểm tra lại mã trên bao bì. Mã lô có dạng COCONUT-001. Lô chưa được tạo trong prototype sẽ không có kết quả." />}
        {!q && <EmptyState icon="qr" title="Chưa có mã tra cứu" desc="Nhập mã lô hoặc mở một lô mẫu bên trên để xem trang truy xuất." />}
      </div>
      <Card className="mt-10 bg-cream">
        <h2 className="text-base">QR hoạt động thế nào?</h2>
        <p className="mt-1 text-sm text-cocoa-soft">QR chỉ chứa một địa chỉ web công khai, không chứa khóa, hóa đơn hay trạng thái. Trạng thái luôn được đọc mới nhất khi mở trang. Trong prototype, địa chỉ có dạng <span className="font-mono">/trace/demo/COCONUT-001</span>; khi triển khai thật sẽ là <span className="font-mono">/trace/&#123;chainId&#125;/&#123;contractAddress&#125;/&#123;tokenId&#125;</span>.</p>
      </Card>
    </div>
  )
}

export function ProductionTrace() {
  const p = useParams()
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState tone="warn" title="Đường dẫn dành cho bản triển khai thật" desc={<>Địa chỉ <span className="font-mono break-all">/trace/{p.chainId}/{p.contractAddress}/{p.tokenId}</span> sẽ đọc trực tiếp RPC và IPFS khi có hợp đồng triển khai. Prototype chưa có hợp đồng, hãy dùng đường dẫn demo.</>} action={<Link to="/trace"><span className="inline-flex h-10 items-center rounded-xl bg-forest px-4 text-sm font-semibold text-white">Tra cứu lô demo</span></Link>} />
    </div>
  )
}

function Accordion({ title, icon, children, open }: { title: string; icon: IconName; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-sage text-forest"><Icon name={icon} /></span>{title}<Icon name="down" className="ml-auto transition-transform group-open:rotate-180" /></summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  )
}

export function TraceDetail() {
  const { code = '' } = useParams()
  const { state, dispatch } = useStore()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'journey' | 'temp' | 'nft' | 'files' | 'params'>('journey')
  const [ver, setVer] = useState<Record<string, boolean>>({})
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 500); return () => clearTimeout(t) }, [code])
  const b = getBatchByCode(state, code)
  if (loading) return <LoadingState label="Đang đọc dữ liệu lô…" />
  if (state.sim.rpcDown) return <div className="mx-auto max-w-2xl px-4 py-16"><ErrorState title="Không kết nối được RPC / IPFS" desc="Dịch vụ đọc dữ liệu công khai tạm thời không khả dụng." action={<Button variant="secondary" onClick={() => dispatch({ type: 'setSim', patch: { rpcDown: false } })}>Tắt lỗi mô phỏng</Button>} /></div>
  if (!b) return <div className="mx-auto max-w-2xl px-4 py-16"><ErrorState tone="warn" title={`Không tìm thấy lô "${code}"`} desc="Mã lô không tồn tại. Kiểm tra lại mã trên bao bì." action={<Link to="/trace"><span className="inline-flex h-10 items-center rounded-xl bg-forest px-4 text-sm font-semibold text-white">Tra cứu lại</span></Link>} /></div>
  const exp = isExpired(b, state)
  const allVer = ver.metadata && ver.certificate && ver.image
  const journey = <Timeline events={b.events} />
  const temp = b.readings.length ? <div className="space-y-4"><TemperatureChart batch={b} /><ReadingsTable batch={b} /></div> : <EmptyState icon="thermo" title="Chưa có bản ghi vận chuyển" desc="Lô chưa đi qua Logistics hoặc chưa có bản ghi từ script Python/Web3.py." />
  const nft = <NFTTransferHistory batch={b} />
  const files = (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">{(['certificate', 'image', 'metadata'] as const).map((k) => <FileCard key={k} batch={b} kind={k} onVerified={(ok) => setVer((v) => ({ ...v, [k]: ok }))} />)}</div>
      <Notice tone="info">Hóa đơn bán buôn riêng không được công khai. Chỉ ví được cấp quyền mới xem được. Hash khớp không đồng nghĩa an toàn thực phẩm.</Notice>
    </div>
  )
  const params = (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KV label="tokenId">#{b.tokenId}</KV><KV label="Hợp đồng">Chưa triển khai (prototype)</KV><KV label="Mạng">Sepolia 11155111 (không kết nối)</KV>
        <KV label="Nhiệt độ ngưỡng">{b.minTemp}–{b.maxTemp}°C</KV><KV label="Phân bón">{b.fertilizer}</KV><KV label="Giống">{b.variety}</KV>
        <KV label="tokenURI"><span className="break-all font-mono text-xs">{b.tokenURI}</span></KV><KV label="Metadata CID"><IPFSCIDChip cid={b.files.metadata.cid} /></KV>
      </dl>
      <QRCard batch={b} compact />
    </div>
  )
  const tabs = [{ id: 'journey' as const, label: 'Hành trình lô', icon: 'route' as const }, { id: 'temp' as const, label: 'Nhiệt độ', icon: 'thermo' as const }, { id: 'nft' as const, label: 'Lịch sử NFT', icon: 'hash' as const }, { id: 'files' as const, label: 'Hồ sơ công khai', icon: 'file' as const }, { id: 'params' as const, label: 'Thông số & blockchain', icon: 'link' as const }]
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><Link to="/trace" className="flex items-center gap-1 font-semibold text-cocoa-soft hover:text-forest"><Icon name="search" className="size-3.5" />Tra cứu lô khác</Link></div>
      {b.recalled && <div className="mb-4"><RecallBanner batch={b} large /></div>}
      {exp && <div className="mb-4"><Notice tone="warn" title="Lô đã hết hạn sử dụng">Ngày hết hạn {fmtDate(b.expiryDate)} đã qua. Không nên sử dụng lô này.</Notice></div>}
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="relative h-56 md:h-auto">
            <img src={b.photo} alt={`Ảnh lô dừa ${b.code}`} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-cocoa/70 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-ivory"><p className="text-xs font-semibold uppercase tracking-widest text-ivory/80">Lô dừa tươi · 1.000 kg · 1 NFT</p><h1 className="text-3xl font-extrabold text-ivory sm:text-4xl">{b.code}</h1></div>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <BatchBadges batch={b} />
            <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${allVer ? 'bg-sage text-forest-dark' : 'bg-ivory text-cocoa-soft'}`}><Icon name={allVer ? 'check' : 'info'} className="size-4" />{allVer ? 'Đã đối chiếu SHA-256 cả 3 tệp công khai' : 'Chưa đối chiếu hash tệp công khai. Bấm "Kiểm tra SHA-256" ở tab Hồ sơ.'}</p>
            <LifecycleStepper status={b.lifecycle} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <KV label="Trang trại">{b.farmId}</KV><KV label="Nhóm thu hoạch">{b.groupId}</KV>
              <KV label="Vị trí">{b.farmLocation}</KV><KV label="Giống">{b.variety}</KV>
              <KV label="Thu hoạch">{fmtDate(b.harvestDate)}</KV><KV label="Hạn dùng">{fmtDate(b.expiryDate)}</KV>
              <KV label="Khối lượng">1.000 kg</KV><KV label="Chủ sở hữu NFT"><OwnerChip id={b.owner} /></KV>
            </dl>
          </div>
        </div>
      </div>
      <div className="mt-6 hidden lg:block">
        <Card pad={false}><Tabs tabs={tabs} value={tab} onChange={setTab} /><div className="p-6">{tab === 'journey' && <div className="grid items-start gap-6 md:grid-cols-[1fr_280px]">{journey}<Notice tone="info" title="Hành trình ≠ lịch sử NFT">Mỗi bàn giao chỉ là một bước (TransferAccepted + Transfer cùng giao dịch). Lịch sử ERC-721 nằm ở tab riêng.</Notice></div>}{tab === 'temp' && temp}{tab === 'nft' && nft}{tab === 'files' && files}{tab === 'params' && params}</div></Card>
      </div>
      <div className="mt-5 space-y-3 lg:hidden">
        <Accordion open title="Hành trình lô" icon="route">{journey}</Accordion>
        <Accordion title="Nhiệt độ vận chuyển" icon="thermo">{temp}</Accordion>
        <Accordion title="Chứng chỉ & hồ sơ công khai" icon="file">{files}</Accordion>
        <Accordion title="Lịch sử NFT (ERC-721)" icon="hash">{nft}</Accordion>
        <Accordion title="Thông số & blockchain" icon="link">{params}</Accordion>
      </div>
      <p className="mt-6 text-center text-xs text-cocoa-soft">Thông tin trên trang này không bảo đảm an toàn thực phẩm hay tính xác thực của chứng chỉ.</p>
    </div>
  )
}

export function NotFound() {
  return <div className="mx-auto max-w-2xl px-4 py-20"><ErrorState tone="warn" title="404 - Không tìm thấy trang" desc="Đường dẫn không tồn tại trong prototype." action={<Link to="/"><span className="inline-flex h-10 items-center rounded-xl bg-forest px-4 text-sm font-semibold text-white">Về trang chủ</span></Link>} /></div>
}
