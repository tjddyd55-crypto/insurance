import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { PublicHomeEntry } from './HomeRedirect'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { CarInsuranceDashboardPage } from './features/application/pages/CarInsuranceDashboardPage'
import GaDelegateManagementPage from './features/admin/pages/GaDelegateManagementPage'
import InsurerManagersPage from './features/insurer-managers/pages/InsurerManagersPage'
import GaManagementPage from './features/admin/pages/GaManagementPage'
import UserManagementPage from './features/admin/pages/UserManagementPage'
import AuditLogsPage from './features/admin/pages/AuditLogsPage'
import { AccountResetPage } from './features/account/pages/AccountResetPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { PasswordResetPage } from './features/auth/pages/PasswordResetPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProfilePage } from './features/auth/pages/ProfilePage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { GaCarInsuranceRoute } from './features/auth/GaCarInsuranceRoute'
import { StaffRoute } from './features/auth/StaffRoute'
import { InsurancePrintPage } from './features/contacts/pages/InsurancePrintPage'
import { InsuranceUpdatesPage } from './features/contacts/pages/InsuranceUpdatesPage'
import { ReinsurerContactsPage } from './features/contacts/pages/ReinsurerContactsPage'
import CustomerCarPage from './features/customers/pages/CustomerCarPage'
import CustomerInputPage from './features/customers/pages/CustomerInputPage'
import CustomersPage from './features/customers/pages/CustomersPage'
import CustomerConsultationsPage from './features/customers/pages/CustomerConsultationsPage'
import TeamMembersPage from './features/team/pages/TeamMembersPage'
import TeamPostsPage from './features/team/pages/TeamPostsPage'
import TeamFilesPage from './features/team/pages/TeamFilesPage'
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
import AdminAnalyticsPage from './features/analytics/pages/AdminAnalyticsPage'
import PrivacyPolicyPage from './features/legal/PrivacyPolicyPage'
import { SuperAdminRoute } from './features/auth/SuperAdminRoute'
import { InsurerManagerOnlyRoute } from './features/auth/InsurerManagerOnlyRoute'
import { RequireNotInsurerManagerRoute } from './features/auth/RequireNotInsurerManagerRoute'
import { AuditLogReaderRoute } from './features/auth/AuditLogReaderRoute'
import { InsurerListPage } from './features/insurer-news/pages/InsurerListPage'
import { InsurerNewsletterListPage } from './features/insurer-news/pages/InsurerNewsletterListPage'
import { NewsletterDetailPage } from './features/insurer-news/pages/NewsletterDetailPage'
import { NewsletterHubPage } from './features/insurer-news/pages/NewsletterHubPage'
import { NewsletterPortalLayout } from './features/insurer-news/pages/NewsletterPortalLayout'
import { NewsletterRecentPage } from './features/insurer-news/pages/NewsletterRecentPage'
import { InsurerManagerNewsDetailPage } from './features/insurer-news/pages/InsurerManagerNewsDetailPage'
import { InsurerManagerNewsListPage } from './features/insurer-news/pages/InsurerManagerNewsListPage'
import { InsurerManagerNewsUploadPage } from './features/insurer-news/pages/InsurerManagerNewsUploadPage'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PublicHomeEntry /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'password-reset', element: <PasswordResetPage /> },
      { path: 'signup', element: <Navigate to="/register" replace /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'privacy-policy', element: <Navigate to="/privacy" replace /> },
      /* 외부 고객 입력(소개 링크) — 비로그인 유지. API는 /customer/external-create + ref 검증 */
      { path: 'customer/input', element: <CustomerInputPage /> },
      { path: 'portal/insurer-news', element: <Navigate to="/insurer/news" replace /> },
      { path: 'portal/insurer-news/*', element: <Navigate to="/insurer/news" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'contacts/manage', element: <Navigate to="/insurance/company-registry" replace /> },
          { path: 'updates', element: <Navigate to="/insurance/history" replace /> },
          {
            element: <InsurerManagerOnlyRoute />,
            children: [
              { path: 'insurer/news', element: <InsurerManagerNewsListPage /> },
              { path: 'insurer/news/upload', element: <InsurerManagerNewsUploadPage /> },
              { path: 'insurer/news/:newsletterId', element: <InsurerManagerNewsDetailPage /> },
            ],
          },
          {
            element: <RequireNotInsurerManagerRoute />,
            children: [
              { path: 'insurance/company-registry', element: <CompanyRegistryPage /> },
              { path: 'insurance/history', element: <InsuranceUpdatesPage /> },
              { path: 'internal/consent', element: <ConsentCompanyPage /> },
              { path: 'internal/consent/form', element: <ConsentFormPage /> },
              {
                path: 'portal/newsletters',
                element: <NewsletterPortalLayout />,
                children: [
                  { index: true, element: <NewsletterHubPage /> },
                  { path: 'recent', element: <NewsletterRecentPage /> },
                  { path: 'insurers', element: <InsurerListPage /> },
                  { path: 'insurers/:insurerSlug', element: <InsurerNewsletterListPage /> },
                  { path: ':newsletterId', element: <NewsletterDetailPage /> },
                ],
              },
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
              { path: 'customers/:id/consultations', element: <CustomerConsultationsPage /> },
              { path: 'team/members', element: <TeamMembersPage /> },
              { path: 'team/posts', element: <TeamPostsPage /> },
              { path: 'team/files', element: <TeamFilesPage /> },
              { path: 'insurer-managers', element: <InsurerManagersPage /> },
              { path: 'customer-car', element: <CustomerCarPage /> },
              { path: 'admin/ga', element: <GaManagementPage /> },
              { path: 'admin/create-ga', element: <Navigate to="/admin/ga" replace /> },
              { path: 'admin/delegates', element: <GaDelegateManagementPage /> },
              { path: 'admin/create-staff', element: <Navigate to="/admin/delegates" replace /> },
              { path: 'admin/users', element: <UserManagementPage /> },
              {
                element: <AuditLogReaderRoute />,
                children: [{ path: 'admin/audit-logs', element: <AuditLogsPage /> }],
              },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'account/reset', element: <AccountResetPage /> },
              { path: 'feature-request', element: <FeatureRequestPage /> },
              { path: 'feature-requests/my', element: <Navigate to="/feature-request" replace /> },
              {
                element: <SuperAdminRoute />,
                children: [
                  {
                    path: 'internal/admin/feature-requests',
                    element: <FeatureRequestsAdminPage />,
                  },
                  {
                    path: 'admin/analytics',
                    element: <AdminAnalyticsPage />,
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
              { path: 'insurance/contacts', element: <InsuranceCompanyContactsViewPage /> },
              { path: 'insurance/general-request', element: <GeneralRequestPage /> },
              { path: 'reinsurer-contacts', element: <ReinsurerContactsPage /> },
              { path: 'insurance/print', element: <InsurancePrintPage /> },
            ],
          },
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
])
