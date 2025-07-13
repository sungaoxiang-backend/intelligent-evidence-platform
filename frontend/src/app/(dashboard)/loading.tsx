import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">加载页面中...</p>
          </div>
        </div>
      </main>
    </div>
  );
}