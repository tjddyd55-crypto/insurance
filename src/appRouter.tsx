import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { HomeRedirect } from './HomeRedirect'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { CarInsuranceDashboardPage } from './features/application/pages/CarInsuranceDashboardPage'
import CreateStaffPage from './features/admin/pages/CreateStaffPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { InsurancePrintPage } from './features/contacts/pages/InsurancePrintPage'
import { InsuranceUpdatesPage } from './features/contacts/pages/InsuranceUpdatesPage'
import { ReinsurerContactsPage } from './features/contacts/pages/ReinsurerContactsPage'
import CustomerCarPage from './features/customers/pages/CustomerCarPage'
import CustomerInputPage from './features/customers/pages/CustomerInputPage'
import CustomersPage from './features/customers/pages/CustomersPage'
import CompanyRegistryPage from './features/company-registry/pages/CompanyRegistryPage'
import GeneralRequestPage from './features/company-registry/pages/GeneralRequestPage'
import InsuranceCompanyContactsViewPage from './features/company-registry/pages/InsuranceCompanyContactsViewPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'customer/input', element: <CustomerInputPage /> },
      { path: 'contacts', element: <Navigate to="/insurance/contacts" replace /> },
      { path: 'contacts/manage', element: <Navigate to="/insurance/company-registry" replace /> },
      { path: 'updates', element: <Navigate to="/insurance/history" replace /> },
      { path: 'insurance/contacts', element: <InsuranceCompanyContactsViewPage /> },
      { path: 'insurance/company-registry', element: <CompanyRegistryPage /> },
      { path: 'insurance/history', element: <InsuranceUpdatesPage /> },
      { path: 'insurance/general-request', element: <GeneralRequestPage /> },
      { path: 'reinsurer-contacts', element: <ReinsurerContactsPage /> },
      { path: 'insurance/print', element: <InsurancePrintPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'admin/create-staff', element: <CreateStaffPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'application', element: <CarInsuranceDashboardPage /> },
          { path: 'application/write', element: <ApplicationFormPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customer-car', element: <CustomerCarPage /> },
          { path: 'my-forms', element: <ApplicationListPage /> },
          { path: 'form/create', element: <ApplicationFormPage /> },
          { path: 'form/:id/edit', element: <ApplicationFormPage /> },
          { path: 'form/result/:id', element: <ApplicationResultPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
