import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
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
import SubscriptionPolicyPage from './features/admin/pages/SubscriptionPolicyPage'
import AdminBillingManagePage, { AdminBillingLegacyRedirect } from './features/billing/pages/AdminBillingManagePage'
import AccountBillingPage from './features/billing/pages/AccountBillingPage'
import { AccountResetPage } from './features/account/pages/AccountResetPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { PasswordResetPage } from './features/auth/pages/PasswordResetPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProfilePage } from './features/auth/pages/ProfilePage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { RequireActiveSubscription } from './features/subscription/RequireActiveSubscription'
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
import CustomerMapPage from './features/customers/pages/CustomerMapPage'
import NaverMapSmokePage from './features/customers/pages/NaverMapSmokePage'
import CustomerWorkspaceLayout from './features/customers/pages/CustomerWorkspaceLayout'
import CustomerWorkspaceHomePage from './features/customers/pages/CustomerWorkspaceHomePage'
import CustomerAutoFormPage from './features/customers/pages/CustomerAutoFormPage'
import TeamMembersPage from './features/team/pages/TeamMembersPage'
import TeamPostsPage from './features/team/pages/TeamPostsPage'
import TeamFilesPage from './features/team/pages/TeamFilesPage'
import CompanyRegistryPage from './features/company-registry/pages/CompanyRegistryPage'
import GeneralRequestPage from './features/company-registry/pages/GeneralRequestPage'
import InsuranceCompanyContactsViewPage from './features/company-registry/pages/InsuranceCompanyContactsViewPage'
import UserInsurerAccountsPage from './features/user-insurer-accounts/pages/UserInsurerAccountsPage'
import ExternalAccountVaultPage from './features/user-insurer-accounts/pages/ExternalAccountVaultPage'
import { ConsentCompanyPage } from './features/consent/pages/ConsentCompanyPage'
import { TemplateEditorPage } from './features/consent/admin/pages/TemplateEditorPage'
import { TemplateListPage } from './features/consent/admin/pages/TemplateListPage'
import PdfTemplateListPage from './features/pdf-engine/pages/PdfTemplateListPage'
import PdfTemplateEditorPage from './features/pdf-engine/pages/PdfTemplateEditorPage'
import PdfDocumentListPage from './features/pdf-engine/pages/PdfDocumentListPage'
import PdfDocumentDetailPage from './features/pdf-engine/pages/PdfDocumentDetailPage'
import PdfIssuanceHistoryPage from './features/pdf-engine/pages/PdfIssuanceHistoryPage'
import { ConsentFormPage } from './features/consent/pages/ConsentFormPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { IntroductionPage } from './features/web/pages/IntroductionPage'
import { IntroductionInstallPage } from './features/web/pages/IntroductionInstallPage'
import FeatureRequestPage from './features/feature-request/pages/FeatureRequestPage'
import FeatureRequestsAdminPage from './features/feature-request/pages/FeatureRequestsAdminPage'
import AdminAnalyticsPage from './features/analytics/pages/AdminAnalyticsPage'
import AdminInsurerSitesPage from './features/insurer-sites/pages/AdminInsurerSitesPage'
import AdminNoticeListPage from './features/admin-notices/pages/AdminNoticeListPage'
import AdminNoticeEditorPage from './features/admin-notices/pages/AdminNoticeEditorPage'
import PlatformHubPage from './features/platform/pages/PlatformHubPage'
import IndustriesListPage from './features/platform/pages/industries/IndustriesListPage'
import IndustryDetailPage from './features/platform/pages/industries/IndustryDetailPage'
import PlatformTenantManagePage from './features/platform/pages/tenants/platform-tenant-manage/PlatformTenantManagePage'
import TenantsListPage from './features/platform/pages/tenants/TenantsListPage'
import MembershipsListPage from './features/platform/pages/memberships/MembershipsListPage'
import ExternalAccountsSummaryPage from './features/platform/pages/external-accounts/ExternalAccountsSummaryPage'
import CustomerTemplatesPage from './features/platform/pages/customer-templates/CustomerTemplatesPage'
import CustomerTemplatePreviewPage from './features/platform/pages/customer-templates/preview/CustomerTemplatePreviewPage'
import CrmCustomerManagementTemplatesListPage from './features/platform/pages/crm-templates/CrmCustomerManagementTemplatesListPage'
import CrmCustomerManagementTemplateEditorPage from './features/platform/pages/crm-templates/CrmCustomerManagementTemplateEditorPage'
import IndustryModeLandingPage from './features/platform/pages/modes/IndustryModeLandingPage'
import TenantModeLandingPage from './features/platform/pages/modes/TenantModeLandingPage'
import PlatformRegistriesPage from './features/platform/pages/registries/PlatformRegistriesPage'
import InsurerSitesPage from './features/insurer-sites/pages/InsurerSitesPage'
import PrivacyPolicyPage from './features/legal/PrivacyPolicyPage'
import AccountDeletionPage from './features/legal/AccountDeletionPage'
import { SuperAdminRoute } from './features/auth/SuperAdminRoute'
import { PdfTemplateAdminRoute } from './features/auth/PdfTemplateAdminRoute'
import { InsuranceClaimAdminRoute } from './features/auth/InsuranceClaimAdminRoute'
import { InsuranceClaimUserRoute } from './features/auth/InsuranceClaimUserRoute'
import { InsuranceClaimUserGate } from './features/auth/InsuranceClaimUserGate'
import InsuranceClaimCompanyListPage from './features/insurance-claim-admin/pages/InsuranceClaimCompanyListPage'
import InsuranceClaimCompanyDetailPage from './features/insurance-claim-admin/pages/InsuranceClaimCompanyDetailPage'
import InsuranceClaimDocumentEditorPage from './features/insurance-claim-admin/pages/InsuranceClaimDocumentEditorPage'
import ClaimRequestFormPage from './features/insurance-claim/pages/ClaimRequestFormPage'
import ClaimRequestHistoryPage from './features/insurance-claim/pages/ClaimRequestHistoryPage'
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
import { DynamicNewsletterBoardDetailPage } from './features/insurer-news/pages/DynamicNewsletterBoardDetailPage'
import { DynamicNewsletterBoardPage } from './features/insurer-news/pages/DynamicNewsletterBoardPage'
import { LossAdjusterManagerNewsDetailPage } from './features/insurer-news/pages/LossAdjusterManagerNewsDetailPage'
import { LossAdjusterManagerNewsListPage } from './features/insurer-news/pages/LossAdjusterManagerNewsListPage'
import { LossAdjusterManagerNewsUploadPage } from './features/insurer-news/pages/LossAdjusterManagerNewsUploadPage'
import { LossAdjusterNewsletterDetailPage } from './features/insurer-news/pages/LossAdjusterNewsletterDetailPage'
import { LossAdjusterNewsletterHubPage } from './features/insurer-news/pages/LossAdjusterNewsletterHubPage'
import { LossAdjusterNewsletterPortalLayout } from './features/insurer-news/pages/LossAdjusterNewsletterPortalLayout'
import { NewsletterBoardAdminPage } from './features/insurer-news/pages/NewsletterBoardAdminPage'
import MemoRoutePage from './features/memo/pages/MemoRoutePage'
import PublicAccountRestrictedPage from './features/common/PublicAccountRestrictedPage'
import { PublicBoardWriterAdminPage } from './features/insurer-news/pages/PublicBoardWriterAdminPage'
import { PublicBoardWriterLoginPage } from './features/insurer-news/pages/PublicBoardWriterLoginPage'
import { PublicBoardWriterWorkspacePage } from './features/insurer-news/pages/PublicBoardWriterWorkspacePage'
import { BoardWriterNewsListPage } from './features/insurer-news/pages/BoardWriterNewsListPage'
import { BoardWriterNewsUploadPage } from './features/insurer-news/pages/BoardWriterNewsUploadPage'
import { BoardWriterNewsDetailPage } from './features/insurer-news/pages/BoardWriterNewsDetailPage'
import { BoardWriterWorkspaceLayout } from './features/insurer-news/pages/BoardWriterWorkspaceLayout'
import MyStoragePage from './features/storage/pages/MyStoragePage'
import TodosWorkspacePage from './features/todos/pages/TodosWorkspacePage'
import NotificationsPlaceholderPage from './features/todos/pages/NotificationsPlaceholderPage'
import AppWorkspaceLayout from './layouts/AppWorkspaceLayout'
import ClaimRequestsRoutePage from './features/claim-requests/pages/ClaimRequestsRoutePage'
import CustomerAppConnectPage from './features/customer-app/pages/CustomerAppConnectPage'
import CustomerAppHomePage from './features/customer-app/pages/CustomerAppHomePage'
import CustomerAppLinkOpenPage from './features/customer-app/pages/CustomerAppLinkOpenPage'
import CustomerAppRequestComposePage from './features/customer-app/pages/CustomerAppRequestComposePage'
import CustomerAppRequestsPage from './features/customer-app/pages/CustomerAppRequestsPage'
import CustomerAppRequestDetailPage from './features/customer-app/pages/CustomerAppRequestDetailPage'
import CustomerAppNewsListPage from './features/customer-app/pages/CustomerAppNewsListPage'
import CustomerAppNewsDetailPage from './features/customer-app/pages/CustomerAppNewsDetailPage'
import CustomerAppProfilePage from './features/customer-app/pages/CustomerAppProfilePage'
import CustomerAppMainLayout from './features/customer-app/components/CustomerAppMainLayout'
import ContractSignPage from './features/contracts/public/ContractSignPage'
import ContractSignDocumentPage from './features/contracts/public/ContractSignDocumentPage'
import { ContractSignatureTestRoute } from './features/contracts/testConsole/ContractSignatureTestRoute'
import ContractSignatureTestConsolePage from './features/contracts/testConsole/ContractSignatureTestConsolePage'
import { ContractSignatureUserSendRoute } from './features/contracts/userSend/ContractSignatureUserSendRoute'
import ContractSignatureSendPage from './features/contracts/userSend/ContractSignatureSendPage'
import ContractSignatureHistoryPage from './features/contracts/userHistory/ContractSignatureHistoryPage'
import CustomerSignaturesRoutePage from './features/customers/pages/CustomerSignaturesRoutePage'
import BillingCheckoutPage from './features/insurance-billing/pages/BillingCheckoutPage'
import BillingRequiredPage from './features/insurance-billing/pages/BillingRequiredPage'
import BillingSuccessPage from './features/insurance-billing/pages/BillingSuccessPage'
import BillingFailPage from './features/insurance-billing/pages/BillingFailPage'
import BillingManagePage from './features/insurance-billing/pages/BillingManagePage'
import { RequireInsuranceBillingEntitlement } from './features/insurance-billing/RequireInsuranceBillingEntitlement'
import FreeLaunchBillingGuard from './features/billing/FreeLaunchBillingGuard'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PublicHomeEntry /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'public-board-writer/login', element: <PublicBoardWriterLoginPage /> },
      { path: 'board-writer/login', element: <PublicBoardWriterLoginPage /> },
      { path: 'public-board-writer/workspace', element: <PublicBoardWriterWorkspacePage /> },
      { path: 'board-writer/workspace', element: <PublicBoardWriterWorkspacePage /> },
      {
        path: 'board-writer/boards/:boardSlug',
        element: <BoardWriterWorkspaceLayout />,
        children: [
          { path: 'news', element: <BoardWriterNewsListPage /> },
          { path: 'news/upload', element: <BoardWriterNewsUploadPage /> },
          { path: 'news/:newsletterId', element: <BoardWriterNewsDetailPage /> },
        ],
      },
      { path: 'register', element: <RegisterPage signupIndustry="insurance" /> },
      { path: 'password-reset', element: <PasswordResetPage /> },
      { path: 'signup', element: <Navigate to="/signup/insurance" replace /> },
      { path: 'signup/insurance', element: <RegisterPage signupIndustry="insurance" /> },
      { path: 'signup/gym', element: <RegisterPage signupIndustry="gym" /> },
      { path: 'signup/government', element: <RegisterPage signupIndustry="government" /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'privacy-policy', element: <Navigate to="/privacy" replace /> },
      { path: 'account-deletion', element: <AccountDeletionPage /> },
      { path: 'introduction', element: <IntroductionPage /> },
      { path: 'introduction/install', element: <IntroductionInstallPage /> },
      { path: 'naver-map-smoke', element: <NaverMapSmokePage /> },
      /* 외부 고객 입력(소개 링크) — 비로그인 유지. API는 /api/customer/external-create + ref·ga 검증 */
      { path: 'customer/input', element: <CustomerInputPage /> },
      { path: 'customer/register', element: <CustomerRegisterPage /> },
      { path: 'contracts/sign/:linkCode', element: <ContractSignPage /> },
      { path: 'share/account-credentials/:token', element: <ExternalAccountVaultPage /> },
      {
        path: 'contracts/sign/:linkCode/documents/:documentInstanceId',
        element: <ContractSignDocumentPage />,
      },
      {
        path: 'customer-app',
        element: <Outlet />,
        children: [
          { index: true, element: <CustomerAppConnectPage /> },
          { path: 'link', element: <CustomerAppLinkOpenPage /> },
          { path: 'connect/:linkCode', element: <CustomerAppConnectPage /> },
          {
            element: <CustomerAppMainLayout />,
            children: [
              { path: 'home', element: <CustomerAppHomePage />, handle: { customerAppMainLabel: '홈' } },
              { path: 'profile', element: <CustomerAppProfilePage />, handle: { customerAppMainLabel: '내정보' } },
              {
                path: 'requests/new',
                element: <CustomerAppRequestComposePage />,
                handle: { customerAppMainLabel: '청구 요청 작성' },
              },
              { path: 'requests', element: <CustomerAppRequestsPage />, handle: { customerAppMainLabel: '문의내역' } },
              {
                path: 'requests/:requestId',
                element: <CustomerAppRequestDetailPage />,
                handle: { customerAppMainLabel: '청구 상세' },
              },
              { path: 'news', element: <Navigate to="/customer-app/news/all" replace /> },
              {
                path: 'news/all',
                element: <CustomerAppNewsListPage />,
                handle: { customerAppMainLabel: '전체소식지' },
              },
              {
                path: 'news/personal',
                element: <CustomerAppNewsListPage />,
                handle: { customerAppMainLabel: '개인소식지' },
              },
              {
                path: 'news/:newsId',
                element: <CustomerAppNewsDetailPage />,
                handle: { customerAppMainLabel: '소식지 상세' },
              },
            ],
          },
        ],
      },
      { path: 'portal/insurer-news', element: <Navigate to="/insurer/news" replace /> },
      { path: 'portal/insurer-news/*', element: <Navigate to="/insurer/news" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <RequireActiveSubscription />,
            children: [
              {
                element: <AppWorkspaceLayout />,
                children: [
              { path: 'billing/checkout', element: <FreeLaunchBillingGuard><BillingCheckoutPage /></FreeLaunchBillingGuard> },
              { path: 'billing/required', element: <FreeLaunchBillingGuard><BillingRequiredPage /></FreeLaunchBillingGuard> },
              { path: 'billing/success', element: <FreeLaunchBillingGuard><BillingSuccessPage /></FreeLaunchBillingGuard> },
              { path: 'billing/fail', element: <FreeLaunchBillingGuard><BillingFailPage /></FreeLaunchBillingGuard> },
              { path: 'billing/manage', element: <FreeLaunchBillingGuard><BillingManagePage /></FreeLaunchBillingGuard> },
              {
                element: <RequireInsuranceBillingEntitlement />,
                children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'public-account-restricted', element: <PublicAccountRestrictedPage /> },
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
              { path: 'insurance/insurer-sites', element: <InsurerSitesPage /> },
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
              { path: 'portal/boards/:boardSlug', element: <DynamicNewsletterBoardPage /> },
              { path: 'portal/boards/:boardSlug/:newsletterId', element: <DynamicNewsletterBoardDetailPage /> },
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
              /*
               * 좌표 기반 PDF 자동화 — 차보험 토글과 무관한 공용 문서 기능이므로
               * GaCarInsuranceRoute 게이트 밖에 둔다.
               * 권한/활성 여부는 서버(GET /pdf-templates · /pdf-templates/:id · /render)에서
               * GA 범위 + 구독 상태로 이중 차단한다.
               */
              { path: 'application/documents', element: <PdfDocumentListPage /> },
              { path: 'application/documents/history', element: <PdfIssuanceHistoryPage /> },
              { path: 'application/documents/:id', element: <PdfDocumentDetailPage /> },
              {
                element: <InsuranceClaimUserRoute />,
                children: [
                  { path: 'insurance-claim/new', element: <ClaimRequestFormPage /> },
                  { path: 'insurance-claim/requests', element: <ClaimRequestHistoryPage /> },
                  { path: 'insurance-claim/requests/:id', element: <ClaimRequestFormPage /> },
                  { path: 'claim-requests', element: <ClaimRequestsRoutePage /> },
                ],
              },
              { path: 'customers/map', element: <CustomerMapPage /> },
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
                  { path: ':customerId/application-documents', element: <PdfDocumentListPage /> },
                  {
                    path: ':customerId/application-documents/history',
                    element: <PdfIssuanceHistoryPage />,
                  },
                  { path: ':customerId/application-documents/:id', element: <PdfDocumentDetailPage /> },
                  { path: ':customerId/signatures', element: <CustomerSignaturesRoutePage /> },
                  {
                    path: ':customerId/claim-requests',
                    element: (
                      <InsuranceClaimUserGate>
                        <ClaimRequestsRoutePage />
                      </InsuranceClaimUserGate>
                    ),
                  },
                ],
              },
              { path: 'storage', element: <MyStoragePage /> },
              { path: 'todos', element: <TodosWorkspacePage /> },
              { path: 'notifications', element: <NotificationsPlaceholderPage /> },
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
              { path: 'admin/newsletter-boards', element: <NewsletterBoardAdminPage /> },
              { path: 'admin/public-board-writers', element: <PublicBoardWriterAdminPage /> },
              {
                element: <SuperAdminRoute />,
                children: [
                  { path: 'admin/billing/manage', element: <AdminBillingManagePage /> },
                  { path: 'admin/subscription/policy', element: <SubscriptionPolicyPage /> },
                  { path: 'admin/subscription/users', element: <AdminBillingLegacyRedirect tab="users" /> },
                  { path: 'admin/subscription/settings', element: <AdminBillingLegacyRedirect tab="payment" /> },
                  { path: 'admin/subscription/billing', element: <AdminBillingLegacyRedirect tab="payment" /> },
                  { path: 'admin/platform', element: <PlatformHubPage /> },
                  { path: 'admin/platform/industries', element: <IndustriesListPage /> },
                  { path: 'admin/platform/industries/:industryId', element: <IndustryDetailPage /> },
                  { path: 'admin/platform/tenants', element: <TenantsListPage /> },
                  {
                    path: 'admin/platform/tenants/:tenantId',
                    element: <PlatformTenantManagePage />,
                  },
                  { path: 'admin/platform/memberships', element: <MembershipsListPage /> },
                  {
                    path: 'admin/platform/external-accounts',
                    element: <ExternalAccountsSummaryPage />,
                  },
                  {
                    path: 'admin/platform/crm-customer-management-templates/new',
                    element: <CrmCustomerManagementTemplateEditorPage />,
                  },
                  {
                    path: 'admin/platform/crm-customer-management-templates/:id/edit',
                    element: <CrmCustomerManagementTemplateEditorPage />,
                  },
                  {
                    path: 'admin/platform/crm-customer-management-templates',
                    element: <CrmCustomerManagementTemplatesListPage />,
                  },
                  {
                    path: 'admin/platform/customer-templates/:templateId/preview',
                    element: <CustomerTemplatePreviewPage />,
                  },
                  {
                    path: 'admin/platform/customer-templates',
                    element: <CustomerTemplatesPage />,
                  },
                  {
                    path: 'admin/platform/registries',
                    element: <PlatformRegistriesPage />,
                  },
                ],
              },
              { path: 'admin/industry/:industryId', element: <IndustryModeLandingPage /> },
              { path: 'admin/tenant/:tenantId', element: <TenantModeLandingPage /> },
              {
                element: <AuditLogReaderRoute />,
                children: [{ path: 'admin/audit-logs', element: <AuditLogsPage /> }],
              },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'account/billing', element: <FreeLaunchBillingGuard><AccountBillingPage /></FreeLaunchBillingGuard> },
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
                  { path: 'admin/insurer-sites', element: <AdminInsurerSitesPage /> },
                  { path: 'admin/notices', element: <AdminNoticeListPage /> },
                  { path: 'admin/notices/new', element: <AdminNoticeEditorPage /> },
                  { path: 'admin/notices/:id', element: <AdminNoticeEditorPage /> },
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
              {
                element: <PdfTemplateAdminRoute />,
                children: [
                  { path: 'admin/pdf-templates', element: <PdfTemplateListPage /> },
                  { path: 'admin/pdf-templates/new', element: <PdfTemplateEditorPage /> },
                  { path: 'admin/pdf-templates/:id', element: <PdfTemplateEditorPage /> },
                ],
              },
              {
                element: <InsuranceClaimAdminRoute />,
                children: [
                  { path: 'admin/claim/insurance-companies', element: <InsuranceClaimCompanyListPage /> },
                  { path: 'admin/claim/insurance-companies/:id', element: <InsuranceClaimCompanyDetailPage /> },
                  {
                    path: 'admin/claim/insurance-companies/:id/documents/:documentId',
                    element: <InsuranceClaimDocumentEditorPage />,
                  },
                ],
              },
              {
                element: <ContractSignatureUserSendRoute />,
                children: [
                  { path: 'contracts/signatures/send', element: <ContractSignatureSendPage /> },
                  { path: 'contracts/signatures/history', element: <ContractSignatureHistoryPage /> },
                ],
              },
              {
                element: <ContractSignatureTestRoute />,
                children: [
                  {
                    path: 'admin/contract-signatures',
                    element: <ContractSignatureTestConsolePage />,
                  },
                  {
                    path: 'admin/contract-signature-test',
                    element: <ContractSignatureTestConsolePage />,
                  },
                ],
              },
              { path: 'contacts', element: <Navigate to="/insurance/contacts" replace /> },
              { path: 'insurance/contacts', element: <InsuranceCompanyContactsViewPage /> },
              { path: 'insurance/account-credentials', element: <UserInsurerAccountsPage /> },
              { path: 'insurance/general-request', element: <GeneralRequestPage /> },
              { path: 'reinsurer-contacts', element: <ReinsurerContactsPage /> },
              { path: 'insurance/print', element: <InsurancePrintPage /> },
                ],
              },
                ],
              },
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
