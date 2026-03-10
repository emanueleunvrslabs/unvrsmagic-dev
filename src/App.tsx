import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ThemeProvider from "./components/theme-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomeRedirect } from "./components/HomeRedirect";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import PublicProjectDetail from "./pages/PublicProjectDetail";
import Auth from "./pages/Auth";
import ProjectDetail from "./pages/ProjectDetail";
import NotificationCenter from "./pages/NotificationCenter";
import AdminDashboard from "./pages/AdminDashboard";
import AdminDemoCalendar from "./pages/AdminDemoCalendar";
import AdminClients from "./pages/AdminClients";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import FinanceDashboard from "./pages/Finance/FinanceDashboard";
import FinanceTransactions from "./pages/Finance/FinanceTransactions";
import FinanceTransfers from "./pages/Finance/FinanceTransfers";
import FinancePayments from "./pages/Finance/FinancePayments";
import AiSocialDashboard from "./pages/AiSocial/AiSocialDashboard";
import GenerateImage from "./pages/AiSocial/GenerateImage";
import GenerateVideo from "./pages/AiSocial/GenerateVideo";
import AvatarStudio from "./pages/AiSocial/AvatarStudio";
import LiveStudio from "./pages/AiSocial/LiveStudio";

import Workflows from "./pages/AiSocial/Workflows";
import Connection from "./pages/AiSocial/Connection";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import FileUpload from "./pages/FileUpload";
import AiArtGenerateImage from "./pages/AiArt/GenerateImage";
import AiArtGenerateVideo from "./pages/AiArt/GenerateVideo";

import Labs from "./pages/Labs";
import Search from "./pages/Search";
import AgentsOverview from "./pages/AiAgents/AgentsOverview";
import AgentDashboard from "./pages/AiAgents/AgentDashboard";
import OpenClawDashboard from "./pages/OpenClaw/OpenClawDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <NotificationProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<HomeRedirect />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/project/:projectId" element={<PublicProjectDetail />} />
          <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/file-upload" element={<ProtectedRoute><FileUpload /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute><AdminClients /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute><AdminAuditLogs /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute><FinanceDashboard /></ProtectedRoute>} />
          <Route path="/admin/finance/transactions" element={<ProtectedRoute><FinanceTransactions /></ProtectedRoute>} />
          <Route path="/admin/finance/transfers" element={<ProtectedRoute><FinanceTransfers /></ProtectedRoute>} />
          <Route path="/admin/finance/payments" element={<ProtectedRoute><FinancePayments /></ProtectedRoute>} />
          <Route path="/admin/demo-calendar" element={<ProtectedRoute><AdminDemoCalendar /></ProtectedRoute>} />
          <Route path="/ai-social" element={<ProtectedRoute><AiSocialDashboard /></ProtectedRoute>} />
          <Route path="/ai-social/generate-image" element={<ProtectedRoute><GenerateImage /></ProtectedRoute>} />
          <Route path="/ai-social/generate-video" element={<ProtectedRoute><GenerateVideo /></ProtectedRoute>} />
          <Route path="/ai-social/avatar-studio" element={<ProtectedRoute><AvatarStudio /></ProtectedRoute>} />
          <Route path="/ai-social/live-studio" element={<ProtectedRoute><LiveStudio /></ProtectedRoute>} />
          <Route path="/ai-social/schedule" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
          <Route path="/ai-social/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
          <Route path="/ai-social/connections" element={<ProtectedRoute><Connection /></ProtectedRoute>} />
          <Route path="/ai-art/generate-image" element={<ProtectedRoute><AiArtGenerateImage /></ProtectedRoute>} />
          <Route path="/ai-art/generate-video" element={<ProtectedRoute><AiArtGenerateVideo /></ProtectedRoute>} />
          <Route path="/labs" element={<ProtectedRoute><Labs /></ProtectedRoute>} />
          <Route path="/ai-agents" element={<ProtectedRoute><AgentsOverview /></ProtectedRoute>} />
          <Route path="/ai-agents/:agentId" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
          <Route path="/openclaw" element={<ProtectedRoute><OpenClawDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* Redirects for removed pages */}
          <Route path="/marketplace" element={<HomeRedirect />} />
          <Route path="/wallet" element={<HomeRedirect />} />
          <Route path="/admin/projects" element={<HomeRedirect />} />
          <Route path="/delibere-arera" element={<HomeRedirect />} />
          <Route path="/memora" element={<HomeRedirect />} />
          <Route path="/m/:refCode" element={<HomeRedirect />} />
          <Route path="/telegram-scraper" element={<HomeRedirect />} />
          <Route path="/nkmt/*" element={<HomeRedirect />} />
          <Route path="/subscription" element={<HomeRedirect />} />
          <Route path="/strategies-marketplace" element={<HomeRedirect />} />
          <Route path="/bot-templates" element={<HomeRedirect />} />
          <Route path="/overview" element={<HomeRedirect />} />
          <Route path="/my-assets" element={<HomeRedirect />} />
          <Route path="/my-analytics" element={<HomeRedirect />} />
          <Route path="/trading" element={<HomeRedirect />} />
          <Route path="/wallets" element={<HomeRedirect />} />
          <Route path="/portfolio-tracker" element={<HomeRedirect />} />
          <Route path="/signal-bot" element={<HomeRedirect />} />
          <Route path="/dca-bot" element={<HomeRedirect />} />
          <Route path="/arbitrage-bot" element={<HomeRedirect />} />
          <Route path="/pump-screener" element={<HomeRedirect />} />
          <Route path="/defi-protocols" element={<HomeRedirect />} />
          <Route path="/defi-center/*" element={<HomeRedirect />} />
          <Route path="/control-panel/*" element={<HomeRedirect />} />
          <Route path="/invite-friends" element={<Navigate to="/settings" replace />} />
          <Route path="/help-center" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
        </NotificationProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
