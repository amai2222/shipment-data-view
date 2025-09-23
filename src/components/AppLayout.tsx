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
      <div className="min-h-screen grid grid-cols-[auto_1fr] w-full bg-gradient-to-br from-background via-background to-secondary/30">
        <AppSidebar />
        
        {/* Main Content Area */}
        <main className="flex flex-col h-screen overflow-hidden">
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