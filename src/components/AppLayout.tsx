import { ReactNode, Suspense } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebarDynamic as AppSidebar } from "./AppSidebarDynamic";
import { EnhancedHeader } from "./EnhancedHeader";
import { PageLoading } from "./ui/loading-spinner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-secondary/30">
        <AppSidebar />
        
        {/* Main Content Area */}
        <main className="flex flex-col flex-1 h-screen">
          <EnhancedHeader />
          
          {/* Content Area with Enhanced Scrolling */}
          <div className="flex-1 overflow-auto bg-gradient-to-b from-background to-secondary/20">
            <Suspense fallback={<PageLoading />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}