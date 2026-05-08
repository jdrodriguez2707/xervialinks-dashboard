import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppLayout({
  user,
  onLogout,
  menuOptions = [],
  activeModule,
  onModuleChange,
  syncStatus,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const formattedDate = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const lastSync = syncStatus?.last_sync
    ? new Intl.DateTimeFormat("es-ES", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }).format(new Date(syncStatus.last_sync))
    : "No sincronizado";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card shadow-lg lg:static lg:shadow-none transition-transform duration-300 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-6 border-b flex items-center justify-between lg:justify-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Ad Manager
          </h1>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuOptions.map((option) => {
            const Icon = option.icon;
            const isActive = activeModule === option.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onModuleChange?.(option.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {Icon && <Icon className="w-5 h-5" />}
                {option.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="bg-muted px-4 py-3 rounded-lg mb-4">
            <p className="text-sm font-semibold truncate">{user?.name || "Usuario"}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">{user?.role || ""}</p>
          </div>

          <Button variant="destructive" className="w-full justify-start gap-2" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card/50 backdrop-blur shrink-0 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-semibold capitalize">{formattedDate}</h2>
              {user?.role === "admin" && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                  </span>
                  Última sinc: {lastSync}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-background">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
