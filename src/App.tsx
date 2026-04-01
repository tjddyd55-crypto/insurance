import { Navigate, Route, Routes } from 'react-router-dom'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { CarInsuranceDashboardPage } from './features/application/pages/CarInsuranceDashboardPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { InsurancePrintPage } from './features/contacts/pages/InsurancePrintPage'
import { InsuranceUpdatesPage } from './features/contacts/pages/InsuranceUpdatesPage'
import { ReinsurerContactsPage } from './features/contacts/pages/ReinsurerContactsPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import CustomersPage from './features/customers/pages/CustomersPage'
import CustomerCarPage from './features/customers/pages/CustomerCarPage'
import CreateStaffPage from './features/admin/pages/CreateStaffPage'
import CompanyRegistryPage from './features/company-registry/pages/CompanyRegistryPage'
import GeneralRequestPage from './features/company-registry/pages/GeneralRequestPage'
import InsuranceCompanyContactsViewPage from './features/company-registry/pages/InsuranceCompanyContactsViewPage'
import { useAuth } from './features/auth/AuthProvider'

function HomeRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/insurance/contacts'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/insurance/contacts" element={<InsuranceCompanyContactsViewPage />} />
      <Route path="/insurance/company-registry" element={<CompanyRegistryPage />} />
      <Route path="/insurance/history" element={<InsuranceUpdatesPage />} />
      <Route path="/insurance/general-request" element={<GeneralRequestPage />} />
      <Route path="/menu/reinsurer-contacts" element={<ReinsurerContactsPage />} />
      <Route path="/menu/company-registry" element={<Navigate to="/insurance/company-registry" replace />} />
      <Route path="/menu/insurance-updates" element={<Navigate to="/insurance/history" replace />} />
      <Route path="/insurance/print" element={<InsurancePrintPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin/create-staff" element={<CreateStaffPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/application" element={<CarInsuranceDashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customer-car" element={<CustomerCarPage />} />
        <Route path="/menu/car-insurance" element={<CarInsuranceDashboardPage />} />
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
