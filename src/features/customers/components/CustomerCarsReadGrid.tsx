import type { CustomerCarFormItem } from '../types/customerCarForm'
import { CustomerCarReadCard } from './CustomerCarReadCard'

export type CustomerCarsReadGridProps = {
  cars: CustomerCarFormItem[]
  loading?: boolean
}

export function CustomerCarsReadGrid({ cars, loading = false }: CustomerCarsReadGridProps) {
  return (
    <section className="customer-car-read-section">
      <h4 className="customer-car-read-section__title">🚗 [자동차보험 정보]</h4>
      {loading ? (
        <p className="customer-car-read-section__loading">자동차 정보를 불러오는 중…</p>
      ) : cars.length > 0 ? (
        <div className="customer-car-read-grid">
          {cars.map((car, index) => (
            <CustomerCarReadCard
              key={car.id != null ? `id-${car.id}` : `i-${index}`}
              car={car}
              index={index}
            />
          ))}
        </div>
      ) : (
        <p className="customer-car-read-section__empty">등록된 자동차 정보가 없습니다.</p>
      )}
    </section>
  )
}
