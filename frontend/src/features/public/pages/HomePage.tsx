import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { Button, Card } from '../../../components/ui'
import { HomeIcon } from '../components/HomeIcon'
import '../styles/home.css'

const examples = ['COCONUT-001', 'COCONUT-002', 'COCONUT-003'] as const

const stages = [
  {
    icon: 'leaf',
    title: 'Nông trại tạo lô',
    description:
      'Farmer ghi 1.000 kg dừa thành một NFT, đính kèm chứng chỉ PDF, ảnh gốc và metadata công khai.',
  },
  {
    icon: 'truck',
    title: 'Vận chuyển có kiểm chứng',
    description:
      'Logistics đối chiếu ba hash trước khi nhận. Nhiệt độ trên đường đi được ghi lại theo từng bản ghi.',
  },
  {
    icon: 'store',
    title: 'Bán lẻ và truy xuất',
    description:
      'Retailer nhận, bán và có thể báo sự cố. Người tiêu dùng quét QR để xem hành trình của lô.',
  },
] as const

export function HomePage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [query, setQuery] = useState('')
  const role = session?.wallet.roles[0]
  const managementUrl = role ? `/${role}/overview` : '/connect'

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = query.trim()
    if (code) navigate(`/trace?q=${encodeURIComponent(code)}`)
  }

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <img
          className="home-hero-image"
          src="/images/home/coconut-grove-hero.jpg"
          alt="Vườn dừa xanh với các hàng dừa dưới bầu trời quang"
          width="1774"
          height="887"
          fetchPriority="high"
        />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="container home-hero-content">
          <div className="home-hero-copy">
            <p className="home-hero-kicker">
              <HomeIcon name="leaf" size={15} /> Dừa tươi nguyên lô · Truy xuất bằng blockchain
            </p>
            <h1 id="home-title">
              Mỗi lô dừa,
              <br />
              một câu chuyện <span>minh bạch</span>.
            </h1>
            <p className="home-hero-description">
              Quét mã QR để biết lô dừa đến từ vườn nào, đi qua những ai, nhiệt độ vận chuyển ra sao
              và hồ sơ gốc ở đâu. Không cần ví, không cần đăng nhập.
            </p>
            <form className="home-search" role="search" aria-label="Tra cứu lô" onSubmit={search}>
              <label htmlFor="home-batch-code">Mã lô hoặc token ID</label>
              <div className="home-search-row">
                <HomeIcon name="search" size={21} />
                <input
                  id="home-batch-code"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nhập mã lô, ví dụ COCONUT-001"
                  required
                />
                <Button type="submit">Tra cứu</Button>
              </div>
            </form>
            <div className="home-examples">
              <span>Thử với dữ liệu mô phỏng:</span>
              {examples.map((code) => (
                <Link key={code} to={`/trace/demo/${code}`}>
                  {code}
                </Link>
              ))}
            </div>
            <Link className="home-wallet-link" to={managementUrl}>
              <HomeIcon name="wallet" size={19} />
              {role ? 'Vào bảng điều khiển' : 'Kết nối ví để quản lý lô'}
            </Link>
          </div>
        </div>
        <span className="home-hero-image-note">Ảnh minh họa</span>
      </section>

      <section className="home-section home-journey container" aria-labelledby="home-journey-title">
        <div className="home-section-heading">
          <p className="home-eyebrow">Hành trình của một lô</p>
          <h2 id="home-journey-title">Ba chặng, một sổ cái chung</h2>
        </div>
        <div className="home-stage-grid">
          {stages.map((stage, index) => (
            <Card className="home-stage" key={stage.title}>
              <span className="home-stage-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="home-stage-icon">
                <HomeIcon name={stage.icon} size={25} />
              </span>
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="home-story" aria-labelledby="home-story-title">
        <div className="container home-story-grid">
          <div className="home-story-photos">
            <img
              src="/images/home/coconut-cluster.jpg"
              alt="Buồng dừa xanh trên cây"
              width="1024"
              height="1536"
              loading="lazy"
            />
            <img
              src="/images/home/coconut-farm.jpg"
              alt="Hàng dừa trên vườn cây xanh"
              width="1024"
              height="1536"
              loading="lazy"
            />
          </div>
          <div className="home-story-copy">
            <p className="home-eyebrow home-eyebrow-harvest">Từ vườn dừa Bến Tre</p>
            <h2 id="home-story-title">Biết rõ vườn nào, nhóm thu hoạch nào</h2>
            <p>
              Mỗi lô gắn với mã trang trại (farmId) và nhóm thu hoạch (harvestGroupId). Khi có sự
              cố, quản trị viên có thể truy ngược các lô liên quan để điều tra, thay vì thu hồi hàng
              loạt.
            </p>
            <ul>
              <li>
                <HomeIcon name="check" size={18} />1 lô = 1.000 kg = 1 NFT ERC-721
              </li>
              <li>
                <HomeIcon name="check" size={18} />
                Chứng chỉ PDF, ảnh và metadata gốc kèm CID và SHA-256
              </li>
              <li>
                <HomeIcon name="check" size={18} />
                Trạng thái Hết hạn và Đã thu hồi hiển thị riêng
              </li>
            </ul>
            <p className="home-story-image-note">Ảnh minh họa, không phải ảnh của một lô cụ thể.</p>
          </div>
        </div>
      </section>

      <section
        className="home-section home-documents container"
        aria-labelledby="home-documents-title"
      >
        <div className="home-documents-copy">
          <p className="home-eyebrow">Hồ sơ công khai</p>
          <h2 id="home-documents-title">Chứng chỉ gốc, không phải ảnh chụp lại</h2>
          <p>
            Bạn có thể mở bản PDF gốc, ảnh gốc và JSON metadata khi lô đã có dữ liệu. Mỗi tệp có CID
            và SHA-256 riêng để đối chiếu. Hash khớp cho biết tệp không bị thay đổi, không thay thế
            kiểm định an toàn thực phẩm.
          </p>
          <Link className="home-document-link" to="/trace/demo/COCONUT-001">
            Xem lô mẫu <HomeIcon name="arrow" size={18} />
          </Link>
          <p className="home-demo-note">
            Lô mẫu sử dụng dữ liệu mô phỏng, chưa xác nhận trên Sepolia.
          </p>
        </div>
        <div className="home-certificate" aria-label="Minh họa cấu trúc hồ sơ công khai">
          <div className="home-certificate-top">
            <span className="home-certificate-mark">
              <HomeIcon name="file" size={25} />
            </span>
            <div>
              <strong>Hồ sơ công khai của lô</strong>
              <span>Minh họa giao diện, chưa có tệp thật</span>
            </div>
          </div>
          <div className="home-certificate-files">
            <div>
              <HomeIcon name="file" size={20} />
              <span>Chứng chỉ PDF gốc</span>
              <small>certificate.pdf</small>
            </div>
            <div>
              <HomeIcon name="image" size={20} />
              <span>Ảnh lô gốc</span>
              <small>batch.jpg</small>
            </div>
            <div>
              <HomeIcon name="json" size={20} />
              <span>Metadata công khai</span>
              <small>metadata.json</small>
            </div>
          </div>
          <div className="home-certificate-proof">
            <span>CID</span>
            <strong>Hiển thị khi có hồ sơ</strong>
            <span>SHA-256</span>
            <strong>Đối chiếu từ tệp gốc</strong>
          </div>
        </div>
      </section>

      <section className="home-partner" aria-labelledby="home-partner-title">
        <div className="container home-partner-inner">
          <div>
            <h2 id="home-partner-title">Bạn là nông hộ, đơn vị vận chuyển hay nhà bán lẻ?</h2>
            <p>
              Quyền truy cập do Admin cấp trên hợp đồng; không có đăng ký tự do hay email/mật khẩu.
            </p>
          </div>
          <Link className="home-partner-link" to={managementUrl}>
            {role ? 'Vào bảng điều khiển' : 'Kết nối ví'} <HomeIcon name="arrow" size={18} />
          </Link>
        </div>
      </section>
    </div>
  )
}
