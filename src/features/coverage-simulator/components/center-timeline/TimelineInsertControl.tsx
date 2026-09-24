type Props = {
  afterOrder: number
  onInsert: (afterOrder: number) => void
  variant?: 'default' | 'marker-tail'
}

export function TimelineInsertControl({ afterOrder, onInsert, variant = 'default' }: Props) {
  return (
    <div
      className={[
        'cs-axis-insert',
        variant === 'marker-tail' ? 'cs-axis-insert--marker-tail' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="presentation"
    >
      <div className="cs-axis-insert__track">
        <span className="cs-axis-insert__line" aria-hidden="true" />
        <button
          type="button"
          className="cs-axis-insert__btn"
          aria-label="항목 추가"
          onClick={() => onInsert(afterOrder)}
        >
          <span className="cs-axis-insert__plus" aria-hidden="true">+</span>
        </button>
        <span className="cs-axis-insert__line" aria-hidden="true" />
      </div>
    </div>
  )
}
