import { FormButton, FormInput } from '../../../../components/form'
import {
  CUSTOMER_MAP_MAX_RADIUS_KM,
  CUSTOMER_MAP_RADIUS_OPTIONS_KM,
} from '../../config/customerMap.config'

type CustomerMapRadiusFilterControlsProps = {
  radiusInput: string
  radiusKm: number | null
  favoriteOnly: boolean
  onRadiusInputChange: (value: string) => void
  onRadiusInputBlur: () => void
  onRadiusInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onRadiusChange: (km: number | null) => void
  onFavoriteOnlyChange: (checked: boolean) => void
  className?: string
}

export default function CustomerMapRadiusFilterControls({
  radiusInput,
  radiusKm,
  favoriteOnly,
  onRadiusInputChange,
  onRadiusInputBlur,
  onRadiusInputKeyDown,
  onRadiusChange,
  onFavoriteOnlyChange,
  className,
}: CustomerMapRadiusFilterControlsProps) {
  const rootClass = ['customers-map-page__radius-group', className].filter(Boolean).join(' ')

  return (
    <>
      <div className={rootClass}>
        <span className="customers-map-page__radius-label">반경</span>
        <FormInput
          type="number"
          min={1}
          max={CUSTOMER_MAP_MAX_RADIUS_KM}
          step={1}
          inputMode="decimal"
          value={radiusInput}
          onChange={(e) => onRadiusInputChange(e.target.value)}
          onBlur={onRadiusInputBlur}
          onKeyDown={onRadiusInputKeyDown}
          className="customers-map-page__radius-input"
          aria-label="반경 km"
        />
        <span className="customers-map-page__radius-unit">km</span>
        {CUSTOMER_MAP_RADIUS_OPTIONS_KM.map((km) => (
          <FormButton
            key={km}
            htmlType="button"
            variant={radiusKm === km ? 'primary' : 'secondary'}
            className={radiusKm === km ? 'customers-map-page__radius-btn--active' : undefined}
            onClick={() => onRadiusChange(km)}
          >
            {km}
          </FormButton>
        ))}
        <FormButton
          htmlType="button"
          variant={radiusKm == null ? 'primary' : 'secondary'}
          onClick={() => onRadiusChange(null)}
        >
          제한 없음
        </FormButton>
      </div>
      <label className="customers-map-page__favorite-only">
        <input
          type="checkbox"
          checked={favoriteOnly}
          onChange={(e) => onFavoriteOnlyChange(e.target.checked)}
        />
        즐겨찾기만
      </label>
    </>
  )
}
