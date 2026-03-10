import { Navigate, Route, Routes } from 'react-router-dom'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ApplicationListPage />} />
      <Route path="/applications/new" element={<ApplicationFormPage />} />
      <Route path="/applications/:id/edit" element={<ApplicationFormPage />} />
      <Route path="/applications/:id/result" element={<ApplicationResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
