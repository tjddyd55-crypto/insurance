import { Navigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import '../styles/personal-binder.css'

export default function PersonalBinderSharedPage() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />

  return (
    <main className="page personal-binder-page personal-binder-page--compact">
      <header className="personal-binder-page-header personal-binder-page-header--compact">
        <h1>공유 바인더</h1>
      </header>
      <section className="personal-binder-shared" aria-label="공유 바인더">
        <div className="personal-binder-shared__list-region">
          <div className="personal-binder-shared__empty">
            <p>아직 공유된 바인더가 없습니다.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
