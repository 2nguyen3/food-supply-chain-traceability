import type { RouteObject } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const publicRoutes: RouteObject[] = [
  {
    index: true,
    element: (
      <>
        <section className="hero">
          <div className="container hero-inner">
            <h1>Truy xuất hành trình của từng lô dừa</h1>
            <p>
              COCOMARK kết nối thông tin từ nông trại, vận chuyển đến nhà bán lẻ. Mỗi lô nguyên trái
              có khối lượng cố định 1.000 kg và tương ứng một NFT ERC-721.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/trace">
                Tra cứu lô
              </Link>
              <Link className="button secondary" to="/connect">
                Kết nối ví
              </Link>
            </div>
          </div>
        </section>
        <section className="container home-note">
          <h2>Thông tin công khai</h2>
          <p>
            Người tiêu dùng có thể tra cứu mà không cần kết nối ví. Dữ liệu thực sẽ hiển thị sau khi
            tích hợp Sepolia và IPFS.
          </p>
        </section>
      </>
    ),
  },
  {
    path: 'trace',
    element: (
      <div className="container home-note">
        <Placeholder title="Tra cứu lô" feature="Tìm lô theo mã hoặc token ID" />
      </div>
    ),
  },
  {
    path: 'trace/demo/:code',
    element: (
      <div className="container home-note">
        <Placeholder
          title="Chi tiết lô: dữ liệu mô phỏng"
          feature="Trang minh họa chỉ dùng fixtures trong giai đoạn phát triển"
        />
      </div>
    ),
  },
  {
    path: 'trace/:chainId/:contractAddress/:tokenId',
    element: (
      <div className="container home-note">
        <Placeholder title="Hành trình lô" feature="Đọc dữ liệu công khai từ Sepolia và IPFS" />
      </div>
    ),
  },
]
