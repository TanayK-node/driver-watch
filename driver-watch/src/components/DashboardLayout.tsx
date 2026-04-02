import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
