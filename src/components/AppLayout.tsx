import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { EnhancedHeader } from "./EnhancedHeader";

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
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}