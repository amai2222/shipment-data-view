import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import TransportOverview from "./pages/TransportOverview";
import Projects from "./pages/Projects";
import Drivers from "./pages/Drivers";
import Locations from "./pages/Locations";
import Partners from "./pages/Partners";
import BusinessEntry from "./pages/BusinessEntry";
import PaymentRequest from "./pages/PaymentRequest";
import FinancialOverview from "./pages/FinancialOverview";
import FinanceReconciliation from "./pages/FinanceReconciliation";
import PaymentInvoice from "./pages/PaymentInvoice";
import NotFound from "./pages/NotFound";
import PaymentRequestsList from "./pages/PaymentRequestsList";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* 公开路由 */}
            <Route path="/auth" element={<Auth />} />
            
            {/* 受保护的路由 */}
            <Route path="/" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/transport" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business']}>
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/financial" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><FinancialOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/projects" element={
              <ProtectedRoute requiredRoles={['admin', 'business']}>
                <AppLayout><Projects /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/drivers" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><Drivers /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/locations" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><Locations /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/partners" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business']}>
                <AppLayout><Partners /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/business-entry" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><BusinessEntry /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-request" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentRequest /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-requests-list" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentRequestsList /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/reconciliation" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><FinanceReconciliation /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/payment-invoice" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentInvoice /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 404路由 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
