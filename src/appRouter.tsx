import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { PublicHomeEntry } from './HomeRedirect'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { CarInsuranceDashboardPage } from './features/application/pages/CarInsuranceDashboardPage'
import CreateStaffPage from './features/admin/pages/CreateStaffPage'
import GaCreatePage from './features/admin/pages/GaCreatePage'
import UserManagementPage from './features/admin/pages/UserManagementPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { GaCarInsuranceRoute } from './features/auth/GaCarInsuranceRoute'
import { StaffRoute } from './features/auth/StaffRoute'
import { InsurancePrintPage } from './features/contacts/pages/InsurancePrintPage'
import { InsuranceUpdatesPage } from './features/contacts/pages/InsuranceUpdatesPage'
import { ReinsurerContactsPage } from './features/contacts/pages/ReinsurerContactsPage'
import CustomerCarPage from './features/customers/pages/CustomerCarPage'
import CustomerInputPage from './features/customers/pages/CustomerInputPage'
import CustomersPage from './features/customers/pages/CustomersPage'
import CompanyRegistryPage from './features/company-registry/pages/CompanyRegistryPage'
import GeneralRequestPage from './features/company-registry/pages/GeneralRequestPage'
import InsuranceCompanyContactsViewPage from './features/company-registry/pages/InsuranceCompanyContactsViewPage'
import { ConsentCompanyPage } from './features/consent/pages/ConsentCompanyPage'
import { TemplateEditorPage } from './features/consent/admin/pages/TemplateEditorPage'
import { TemplateListPage } from './features/consent/admin/pages/TemplateListPage'
import { ConsentFormPage } from './features/consent/pages/ConsentFormPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import FeatureRequestPage from './features/feature-request/pages/FeatureRequestPage'
import FeatureRequestsAdminPage from './features/feature-request/pages/FeatureRequestsAdminPage'
import MyFeatureRequestsPage from './features/feature-request/pages/MyFeatureRequestsPage'
import PrivacyPolicyPage from './features/legal/PrivacyPolicyPage'
import { SuperAdminRoute } from './features/auth/SuperAdminRoute'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PublicHomeEntry /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'signup', element: <Navigate to="/register" replace /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'privacy-policy', element: <Navigate to="/privacy" replace /> },
      /* 외부 고객 입력(소개 링크) — 비로그인 유지. API는 /customer/external-create + ref 검증 */
      { path: 'customer/input', element: <CustomerInputPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          {
            element: <GaCarInsuranceRoute />,
            children: [
              { path: 'application', element: <CarInsuranceDashboardPage /> },
              { path: 'application/write', element: <ApplicationFormPage /> },
              { path: 'my-forms', element: <ApplicationListPage /> },
              { path: 'form/create', element: <ApplicationFormPage /> },
              { path: 'form/:id/edit', element: <ApplicationFormPage /> },
              { path: 'form/result/:id', element: <ApplicationResultPage /> },
            ],
          },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customer-car', element: <CustomerCarPage /> },
          { path: 'admin/create-ga', element: <GaCreatePage /> },
          { path: 'admin/create-staff', element: <CreateStaffPage /> },
          { path: 'admin/users', element: <UserManagementPage /> },
          { path: 'feature-request', element: <FeatureRequestPage /> },
          { path: 'feature-requests/my', element: <MyFeatureRequestsPage /> },
          {
            element: <SuperAdminRoute />,
            children: [
              {
                path: 'internal/admin/feature-requests',
                element: <FeatureRequestsAdminPage />,
              },
            ],
          },
          {
            element: <StaffRoute />,
            children: [
              { path: 'internal/admin/consent-template', element: <TemplateListPage /> },
              { path: 'internal/admin/consent-template/edit', element: <TemplateEditorPage /> },
              { path: 'internal/admin/consent-template/edit/:id', element: <TemplateEditorPage /> },
            ],
          },
          { path: 'contacts', element: <Navigate to="/insurance/contacts" replace /> },
          { path: 'contacts/manage', element: <Navigate to="/insurance/company-registry" replace /> },
          { path: 'updates', element: <Navigate to="/insurance/history" replace /> },
          { path: 'insurance/contacts', element: <InsuranceCompanyContactsViewPage /> },
          { path: 'insurance/company-registry', element: <CompanyRegistryPage /> },
          { path: 'insurance/history', element: <InsuranceUpdatesPage /> },
          { path: 'insurance/general-request', element: <GeneralRequestPage /> },
          { path: 'reinsurer-contacts', element: <ReinsurerContactsPage /> },
          { path: 'insurance/print', element: <InsurancePrintPage /> },
          /* 내부 전용: 메인 메뉴 비노출, URL 직접 접근 */
          { path: 'internal/consent', element: <ConsentCompanyPage /> },
          { path: 'internal/consent/form', element: <ConsentFormPage /> },
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
])
