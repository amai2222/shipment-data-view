import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import Home from "./pages/Home";
import TransportOverview from "./pages/TransportOverview";
import Projects from "./pages/Projects";
import Drivers from "./pages/Drivers";
import Locations from "./pages/Locations";
import Partners from "./pages/Partners";
import BusinessEntry from "./pages/BusinessEntry";
import FinancialOverview from "./pages/FinancialOverview";
import FinanceReconciliation from "./pages/FinanceReconciliation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><TransportOverview /></AppLayout>} />
          <Route path="/dashboard/transport" element={<AppLayout><TransportOverview /></AppLayout>} />
          <Route path="/dashboard/financial" element={<AppLayout><FinancialOverview /></AppLayout>} />
          <Route path="/projects" element={<AppLayout><Projects /></AppLayout>} />
          <Route path="/drivers" element={<AppLayout><Drivers /></AppLayout>} />
          <Route path="/locations" element={<AppLayout><Locations /></AppLayout>} />
          <Route path="/partners" element={<AppLayout><Partners /></AppLayout>} />
          <Route path="/business-entry" element={<AppLayout><BusinessEntry /></AppLayout>} />
          <Route path="/finance/reconciliation" element={<AppLayout><FinanceReconciliation /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
