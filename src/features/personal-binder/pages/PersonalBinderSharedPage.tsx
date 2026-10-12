import FormButton from '../../../components/form/FormButton'
import '../styles/personal-binder.css'

export default function PersonalBinderSharedPage() {
  return (
    <section className="personal-binder-shared" aria-labelledby="personal-binder-shared-title">
      <header className="personal-binder-shared__header">
        <h2 id="personal-binder-shared-title">공유 바인더</h2>
        <p>같은 지점에서 공유된 상담 바인더를 확인할 수 있습니다.</p>
      </header>
      <div className="personal-binder-shared__list-region" aria-label="공유 바인더 목록">
        <div className="personal-binder-shared__empty">
          <p>아직 공유된 바인더가 없습니다.</p>
        </div>
      </div>
    </section>
  )
}

export function PersonalBinderMainTabs({
  active,
  onSelectMine,
  onSelectShared,
}: {
  active: 'mine' | 'shared'
  onSelectMine: () => void
  onSelectShared: () => void
}) {
  return (
    <nav className="personal-binder-main-tabs" aria-label="바인더 메뉴">
      <FormButton
        variant={active === 'mine' ? 'primary' : 'secondary'}
        size="sm"
        onClick={onSelectMine}
      >
        내 바인더
      </FormButton>
      <FormButton
        variant={active === 'shared' ? 'primary' : 'secondary'}
        size="sm"
        onClick={onSelectShared}
      >
        공유 바인더
      </FormButton>
    </nav>
  )
}
