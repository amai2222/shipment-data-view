import { ReactNode } from "react";
import { Truck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { forceReimportData } from "@/utils/importData";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background to-secondary">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-gradient-primary shadow-lg sticky top-0 z-50">
            <div className="flex justify-between items-center h-16 px-6">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="text-white hover:bg-white/20 transition-colors" />
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">中科物流业务跟踪系统</h1>
                  <p className="text-sm text-white/80">高效管理 · 精准统计</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  forceReimportData();
                  window.location.reload();
                }}
                className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                <span>重新导入数据</span>
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}