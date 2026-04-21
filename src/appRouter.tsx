import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { PublicHomeEntry } from './HomeRedirect'
import { ApplicationFormPage } from './features/application/pages/ApplicationFormPage'
import { ApplicationListPage } from './features/application/pages/ApplicationListPage'
import ApplicationPage from './features/application/pages/ApplicationPage'
import { ApplicationResultPage } from './features/application/pages/ApplicationResultPage'
import { DirectAutoPage } from './features/application/pages/DirectAutoPage'
import GaDelegateManagementPage from './features/admin/pages/GaDelegateManagementPage'
import InsurerManagersPage from './features/insurer-managers/pages/InsurerManagersPage'
import LossAdjustersPage from './features/loss-adjusters/pages/LossAdjustersPage'
import GaManagementPage from './features/admin/pages/GaManagementPage'
import GaCompanyManagePage from './features/admin/pages/GaCompanyManagePage'
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
import CustomerRegisterPage from './features/customers/pages/CustomerRegisterPage'
import CustomerConsultationsPage from './features/customers/pages/CustomerConsultationsPage'
import CustomerFilesPage from './features/customers/pages/CustomerFilesPage'
import CustomerGaExcelPage from './features/customers/pages/CustomerGaExcelPage'
import CustomerMemosPage from './features/customers/pages/CustomerMemosPage'
import CustomerWorkspaceLayout from './features/customers/pages/CustomerWorkspaceLayout'
import CustomerWorkspaceHomePage from './features/customers/pages/CustomerWorkspaceHomePage'
import CustomerAutoFormPage from './features/customers/pages/CustomerAutoFormPage'
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
import { IntroductionPage } from './features/web/pages/IntroductionPage'
import { IntroductionInstallPage } from './features/web/pages/IntroductionInstallPage'
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
import { LossAdjusterManagerNewsDetailPage } from './features/insurer-news/pages/LossAdjusterManagerNewsDetailPage'
import { LossAdjusterManagerNewsListPage } from './features/insurer-news/pages/LossAdjusterManagerNewsListPage'
import { LossAdjusterManagerNewsUploadPage } from './features/insurer-news/pages/LossAdjusterManagerNewsUploadPage'
import { LossAdjusterNewsletterDetailPage } from './features/insurer-news/pages/LossAdjusterNewsletterDetailPage'
import { LossAdjusterNewsletterHubPage } from './features/insurer-news/pages/LossAdjusterNewsletterHubPage'
import { LossAdjusterNewsletterPortalLayout } from './features/insurer-news/pages/LossAdjusterNewsletterPortalLayout'
import MemoRoutePage from './features/memo/pages/MemoRoutePage'
import MyStoragePage from './features/storage/pages/MyStoragePage'
import AppWorkspaceLayout from './layouts/AppWorkspaceLayout'
import ClaimRequestsPage from './features/claim-requests/pages/ClaimRequestsPage'
import CustomerAppConnectPage from './features/customer-app/pages/CustomerAppConnectPage'
import CustomerAppHomePage from './features/customer-app/pages/CustomerAppHomePage'
import CustomerAppRequestComposePage from './features/customer-app/pages/CustomerAppRequestComposePage'
import CustomerAppRequestsPage from './features/customer-app/pages/CustomerAppRequestsPage'
import CustomerAppRequestDetailPage from './features/customer-app/pages/CustomerAppRequestDetailPage'
import CustomerAppNewsListPage from './features/customer-app/pages/CustomerAppNewsListPage'
import CustomerAppNewsDetailPage from './features/customer-app/pages/CustomerAppNewsDetailPage'
import CustomerAppProfilePage from './features/customer-app/pages/CustomerAppProfilePage'

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
      { path: 'introduction', element: <IntroductionPage /> },
      { path: 'introduction/install', element: <IntroductionInstallPage /> },
      /* 외부 고객 입력(소개 링크) — 비로그인 유지. API는 /api/customer/external-create + ref·ga 검증 */
      { path: 'customer/input', element: <CustomerInputPage /> },
      { path: 'customer/register', element: <CustomerRegisterPage /> },
      { path: 'customer-app', element: <CustomerAppConnectPage /> },
      { path: 'customer-app/connect/:linkCode', element: <CustomerAppConnectPage /> },
      { path: 'customer-app/home', element: <CustomerAppHomePage /> },
      { path: 'customer-app/profile', element: <CustomerAppProfilePage /> },
      { path: 'customer-app/requests/new', element: <CustomerAppRequestComposePage /> },
      { path: 'customer-app/requests', element: <CustomerAppRequestsPage /> },
      { path: 'customer-app/requests/:requestId', element: <CustomerAppRequestDetailPage /> },
      { path: 'customer-app/news', element: <Navigate to="/customer-app/news/all" replace /> },
      { path: 'customer-app/news/all', element: <CustomerAppNewsListPage /> },
      { path: 'customer-app/news/personal', element: <CustomerAppNewsListPage /> },
      { path: 'customer-app/news/:newsId', element: <CustomerAppNewsDetailPage /> },
      { path: 'portal/insurer-news', element: <Navigate to="/insurer/news" replace /> },
      { path: 'portal/insurer-news/*', element: <Navigate to="/insurer/news" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppWorkspaceLayout />,
            children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'contacts/manage', element: <Navigate to="/insurance/company-registry" replace /> },
          { path: 'updates', element: <Navigate to="/insurance/history" replace /> },
          {
            element: <InsurerManagerOnlyRoute allowedRoles={['INSURER_MANAGER']} />,
            children: [
              { path: 'insurer/news', element: <InsurerManagerNewsListPage /> },
              { path: 'insurer/news/upload', element: <InsurerManagerNewsUploadPage /> },
              { path: 'insurer/news/:newsletterId', element: <InsurerManagerNewsDetailPage /> },
            ],
          },
          {
            element: <InsurerManagerOnlyRoute allowedRoles={['LOSS_ADJUSTER']} />,
            children: [
              { path: 'adjuster/news', element: <LossAdjusterManagerNewsListPage /> },
              { path: 'adjuster/news/upload', element: <LossAdjusterManagerNewsUploadPage /> },
              { path: 'adjuster/news/:newsletterId', element: <LossAdjusterManagerNewsDetailPage /> },
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
                path: 'portal/adjuster-news',
                element: <LossAdjusterNewsletterPortalLayout />,
                children: [
                  { index: true, element: <LossAdjusterNewsletterHubPage /> },
                  { path: 'recent', element: <LossAdjusterNewsletterHubPage /> },
                  { path: ':newsletterId', element: <LossAdjusterNewsletterDetailPage /> },
                ],
              },
              {
                element: <GaCarInsuranceRoute />,
                children: [
                  { path: 'application', element: <ApplicationPage /> },
                  { path: 'app/auto-insurance', element: <ApplicationFormPage /> },
                  { path: 'application/direct-auto', element: <DirectAutoPage /> },
                  { path: 'application/write', element: <ApplicationFormPage /> },
                  { path: 'my-forms', element: <ApplicationListPage /> },
                  { path: 'form/create', element: <ApplicationFormPage /> },
                  { path: 'form/:id/edit', element: <ApplicationFormPage /> },
                  { path: 'form/result/:id', element: <ApplicationResultPage /> },
                ],
              },
              {
                path: 'customers',
                element: <CustomerWorkspaceLayout />,
                children: [
                  { index: true, element: <CustomerWorkspaceHomePage /> },
                  { path: ':customerId/files', element: <CustomerFilesPage /> },
                  { path: ':customerId/consultations', element: <CustomerConsultationsPage /> },
                  { path: ':customerId/ga-excel', element: <CustomerGaExcelPage /> },
                  { path: ':customerId/memos', element: <CustomerMemosPage /> },
                  { path: ':customerId/auto-form', element: <CustomerAutoFormPage /> },
                ],
              },
              { path: 'storage', element: <MyStoragePage /> },
              { path: 'team/members', element: <TeamMembersPage /> },
              { path: 'team/manage', element: <Navigate to="/team/members" replace /> },
              { path: 'team/menu-settings', element: <Navigate to="/team/members" replace /> },
              { path: 'team/admin', element: <Navigate to="/team/members" replace /> },
              { path: 'team/posts', element: <TeamPostsPage /> },
              { path: 'team/files', element: <TeamFilesPage /> },
              { path: 'memo', element: <MemoRoutePage /> },
              { path: 'insurer-managers', element: <InsurerManagersPage /> },
              { path: 'loss-adjusters', element: <LossAdjustersPage /> },
              { path: 'customer-car', element: <CustomerCarPage /> },
              { path: 'admin/ga', element: <GaManagementPage /> },
              { path: 'admin/ga/:gaId', element: <GaCompanyManagePage /> },
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
              { path: 'claim-requests', element: <ClaimRequestsPage /> },
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
    ],
  },
])
