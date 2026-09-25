import FormButton from '../../../../components/form/FormButton'

type Props = {
  cancelLabel: string
  primaryLabel: string
  onCancel: () => void
  onPrimary: () => void
  primaryDisabled?: boolean
}

export function FormActionFooter({
  cancelLabel,
  primaryLabel,
  onCancel,
  onPrimary,
  primaryDisabled = false,
}: Props) {
  return (
    <div className="cs-form-primitive__footer-actions">
      <FormButton variant="secondary" fullWidth onClick={onCancel}>
        {cancelLabel}
      </FormButton>
      <FormButton variant="primary" fullWidth disabled={primaryDisabled} onClick={onPrimary}>
        {primaryLabel}
      </FormButton>
    </div>
  )
}
