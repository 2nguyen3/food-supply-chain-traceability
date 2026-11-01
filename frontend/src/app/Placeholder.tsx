import { Card, PageHeader } from '../components/ui'
export function Placeholder({ title, feature }: { title: string; feature: string }) {
  return (
    <div className="placeholder">
      <PageHeader title={title} description="Khu vực này đang chờ triển khai nghiệp vụ." />
      <Card>
        <h2>{feature}</h2>
        <p className="muted">
          Khung giao diện và đường dẫn đã sẵn sàng. Dữ liệu và thao tác thực sẽ được tích hợp trong
          giai đoạn tiếp theo.
        </p>
      </Card>
    </div>
  )
}
