"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Layers,
  Settings,
  LogOut,
  RefreshCw,
  List,
  RotateCw,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, apiKey, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("INR");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Fetch balance from API
  const fetchBalance = useCallback(async () => {
    if (!apiKey) {
      setBalance(null);
      return;
    }
    setBalanceLoading(true);
    setApiError(false);
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "balance", key: apiKey }),
      });
      const data = await res.json();
      if (data && data.balance) {
        setBalance(Number(data.balance).toFixed(2));
        setCurrency(data.currency || "INR");
      } else if (data && data.error) {
        console.error("Balance fetch API error:", data.error);
        setApiError(true);
      } else {
        setApiError(true);
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
      setApiError(true);
    } finally {
      setBalanceLoading(false);
    }
  }, [apiKey]);

  // Sync balance when API key updates
  useEffect(() => {
    if (apiKey) {
      const timer = setTimeout(() => {
        fetchBalance();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [apiKey, fetchBalance]);

  // Route guarding
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-cyber-bg font-sans text-cyber-purple">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-cyber-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="animate-pulse text-base tracking-wide text-slate-300">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", shortName: "Home", path: "/dashboard", icon: LayoutDashboard },
    { name: "Place Orders", shortName: "Orders", path: "/dashboard/order", icon: Layers },
    { name: "Services Catalog", shortName: "Services", path: "/dashboard/services", icon: List },
    { name: "Refill Logs", shortName: "Refills", path: "/dashboard/refills", icon: RotateCw },
    { name: "API Configuration", shortName: "API", path: "/dashboard/settings", icon: Settings, hideOnMobile: true },
  ];

  return (
    <div className="min-h-screen w-full flex bg-cyber-bg text-slate-300 font-sans relative">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-cyber-card border-r border-cyber-border flex-col justify-between z-10 shrink-0 h-screen sticky top-0 overflow-y-auto">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-cyber-border justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                NextWaveSMM
              </span>
            </Link>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-slate-400 font-medium bg-slate-800/50">
              Workspace
            </div>
          </div>

          {/* User profile & API info card */}
          <div className="p-5 border-b border-cyber-border bg-cyber-bg/20">
            <div className="text-[11px] text-slate-500 font-medium mb-1">
              Signed in as
            </div>
            <div className="text-sm font-medium text-slate-200 truncate mb-4">
              {user.email}
            </div>

            {/* SMM Balance Display */}
            <div className="bg-cyber-bg border border-cyber-border rounded-lg p-4 flex flex-col relative overflow-hidden">
              <div className="text-xs text-slate-400 font-medium flex justify-between items-center mb-1.5">
                Current Balance
                {apiKey && (
                  <button
                    onClick={fetchBalance}
                    disabled={balanceLoading}
                    className="text-cyber-blue hover:text-cyber-green transition-colors disabled:opacity-50"
                    title="Refresh Balance"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${balanceLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                )}
              </div>

              {apiKey ? (
                apiError ? (
                  <div className="text-xs text-cyber-red font-semibold">
                    API Key Rejected
                  </div>
                ) : balance !== null ? (
                  <div className="text-xl font-semibold text-white flex items-baseline gap-1">
                    ₹{balance}
                    <span className="text-xs text-slate-500 font-normal ml-0.5">
                      {currency}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Loading balance...
                  </div>
                )
              ) : (
                <Link
                  href="/dashboard/settings"
                  className="text-xs text-cyber-red font-semibold hover:underline"
                >
                  Configure API Key
                </Link>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all relative border border-transparent ${
                    isActive
                      ? "bg-cyber-purple/10 text-cyber-purple border-cyber-purple/20 font-medium"
                      : "hover:bg-cyber-input hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-cyber-purple rounded-r"></span>
                  )}
                  <Icon
                    className={`w-4.5 h-4.5 ${isActive ? "text-cyber-purple" : "text-slate-400 group-hover:text-white"}`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-cyber-border space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-cyber-red hover:bg-cyber-red/10 border border-transparent hover:border-cyber-red/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5 text-cyber-red" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-cyber-bg relative z-10 pb-20 lg:pb-0">
        {/* Top Header info */}
        <header className="h-16 border-b border-cyber-border px-4 lg:px-8 flex items-center justify-between shrink-0 bg-cyber-card/25 backdrop-blur-sm">
          {/* On mobile: show Brand logo */}
          <div className="flex items-center gap-1 lg:hidden">
            <span className="text-base font-bold tracking-tight text-white">
              NextWaveSMM
            </span>
          </div>

          {/* On desktop: show Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm text-slate-400 font-medium capitalize">
              {pathname === "/dashboard" ? "Overview" : pathname.replace("/dashboard/", "").replace("-", " ")}
            </span>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* On mobile: SMM Balance indicator */}
            {apiKey && balance !== null && (
              <div className="lg:hidden text-xs bg-cyber-input border border-cyber-border rounded px-2.5 py-1 text-cyber-green font-bold flex items-center gap-1">
                <span>₹ {balance}</span>
              </div>
            )}

            {/* Theme Toggle Button */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 text-slate-400 hover:text-white hover:bg-cyber-input rounded-lg border border-transparent transition-all cursor-pointer"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5 text-slate-800" />}
              </button>
            )}

            {/* On mobile: Settings Icon Button */}
            <Link
              href="/dashboard/settings"
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-cyber-input rounded-lg border border-transparent transition-all"
              title="Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </Link>

            {/* On mobile: Sign Out Icon Button */}
            <button
              onClick={handleLogout}
              className="lg:hidden p-2 text-cyber-red hover:bg-cyber-red/10 rounded-lg border border-transparent hover:border-cyber-red/20 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>

            {/* Removed Fake "Connection Secure" */}
          </div>
        </header>

        {/* Child Components Workspace */}
        <div className="flex-1 p-4 lg:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-cyber-card border-t border-cyber-border flex items-center justify-around z-50 backdrop-blur-md bg-opacity-95 px-1">
        {navItems.filter(item => !item.hideOnMobile).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full text-center transition-all ${
                isActive
                  ? "text-cyber-purple font-medium"
                  : "text-slate-450 hover:text-white"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-cyber-purple" : "text-slate-400"}`}
              />
              <span className="text-[10px] tracking-wide font-semibold">
                {item.shortName}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
