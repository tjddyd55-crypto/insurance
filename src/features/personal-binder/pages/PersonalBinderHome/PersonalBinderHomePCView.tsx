import type { PersonalBinderHomeViewProps } from './personalBinderHomeViewProps'

export default function PersonalBinderHomePCView(props: PersonalBinderHomeViewProps) {
  return (
    <main className="page personal-binder-page personal-binder-page--compact personal-binder-page--pc personal-binder-page--workspace personal-binder-page--workspace-studio">
      <header className="personal-binder-page-header personal-binder-page-header--compact">
        <h1>내 바인더</h1>
      </header>
      {props.error ? <p className="personal-binder-error">{props.error}</p> : null}
      {props.loading ? <div className="personal-binder-status">불러오는 중…</div> : <div className="personal-binder-workspace__body personal-binder-workspace__body--studio">{props.pcContent}</div>}
      {props.dialogs}
    </main>
  )
}
