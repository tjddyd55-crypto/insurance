import type { CustomerCarFormItem } from '../types/customerCarForm'
import { CustomerCarReadCard } from './CustomerCarReadCard'

export type CustomerCarsReadGridProps = {
  cars: CustomerCarFormItem[]
  loading?: boolean
}

export function CustomerCarsReadGrid({ cars, loading = false }: CustomerCarsReadGridProps) {
  if (loading) {
    return <p className="customer-car-read-section__loading">자동차 정보를 불러오는 중…</p>
  }
  if (cars.length > 0) {
    return (
      <div className="customer-car-read-grid">
        {cars.map((car, index) => (
          <CustomerCarReadCard
            key={car.id != null ? `id-${car.id}` : `i-${index}`}
            car={car}
            index={index}
          />
        ))}
      </div>
    )
  }
  return <p className="customer-car-read-section__empty">등록된 자동차 정보가 없습니다.</p>
}
