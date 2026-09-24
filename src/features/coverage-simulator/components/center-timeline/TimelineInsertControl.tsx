type Props = {
  afterOrder: number
  onInsert: (afterOrder: number) => void
}

export function TimelineInsertControl({ afterOrder, onInsert }: Props) {
  return (
    <div className="cs-axis-insert" role="presentation">
      <div className="cs-axis-insert__line" aria-hidden="true" />
      <button
        type="button"
        className="cs-axis-insert__btn coverage-simulator-add-slot"
        aria-label="항목 추가"
        onClick={() => onInsert(afterOrder)}
      />
    </div>
  )
}
