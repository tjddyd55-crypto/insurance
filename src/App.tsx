import { Navigate, Route, Routes } from 'react-router-dom'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { useAuth } from './features/auth/AuthProvider'

function HomeRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-forms" element={<ApplicationListPage />} />
        <Route path="/form/create" element={<ApplicationFormPage />} />
        <Route path="/form/:id/edit" element={<ApplicationFormPage />} />
        <Route path="/form/result/:id" element={<ApplicationResultPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
