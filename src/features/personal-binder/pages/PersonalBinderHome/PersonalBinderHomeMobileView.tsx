import FormButton from '../../../../components/form/FormButton'
import type { PersonalBinderHomeViewProps } from './personalBinderHomeViewProps'

export default function PersonalBinderHomeMobileView(props: PersonalBinderHomeViewProps) {
  return (
    <main className="page personal-binder-page personal-binder-page--compact personal-binder-page--mobile">
      <header className="personal-binder-page-header personal-binder-page-header--compact">
        <h1>내 바인더</h1>
        <FormButton variant="primary" size="sm" onClick={props.onCreateBinder}>+ 바인더</FormButton>
      </header>
      {props.error ? <p className="personal-binder-error">{props.error}</p> : null}
      {props.loading ? <div className="personal-binder-status">불러오는 중…</div> : props.mobileContent}
      {props.dialogs}
    </main>
  )
}
