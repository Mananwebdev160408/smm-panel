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
  Terminal,
  Activity
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, apiKey, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
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
        setCurrency(data.currency || "USD");
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
      fetchBalance();
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
      <div className="flex h-screen w-screen items-center justify-center bg-cyber-bg font-mono text-cyber-green">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-cyber-green border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="animate-pulse">DECRYPTING ACCESS SHELL...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Terminal Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Multi-Order Deck", path: "/dashboard/order", icon: Layers },
    { name: "Node API Settings", path: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen w-full flex bg-cyber-bg text-slate-300 font-mono relative scanlines">
      {/* Sidebar */}
      <aside className="w-64 bg-cyber-card border-r border-cyber-border flex flex-col justify-between z-10 shrink-0">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-cyber-border justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-black tracking-widest text-white">
                BUZZ<span className="text-cyber-green glow-green">SHADOW</span>
              </span>
            </Link>
            <div className="flex items-center gap-1.5 bg-cyber-green/10 border border-cyber-green/20 px-2 py-0.5 rounded text-[9px] text-cyber-green font-bold uppercase animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green"></span>
              LIVE
            </div>
          </div>

          {/* User profile & API info card */}
          <div className="p-4 border-b border-cyber-border bg-cyber-bg/40">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Active Access Deck
            </div>
            <div className="text-xs font-bold text-white truncate mb-2">
              {user.email}
            </div>

            {/* SMM Balance Display */}
            <div className="bg-cyber-input border border-cyber-border rounded p-3 mt-2 flex flex-col relative overflow-hidden">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center mb-1">
                SMM PANEL BALANCE
                {apiKey && (
                  <button
                    onClick={fetchBalance}
                    disabled={balanceLoading}
                    className="text-cyber-blue hover:text-cyber-green transition-colors disabled:opacity-50"
                    title="Refresh Balance"
                  >
                    <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
                  </button>
                )}
              </div>

              {apiKey ? (
                apiError ? (
                  <div className="text-[10px] text-cyber-red font-bold">
                    [ API KEY REJECTED ]
                  </div>
                ) : balance !== null ? (
                  <div className="text-base font-extrabold text-cyber-green glow-green flex items-baseline gap-1">
                    $ {balance}
                    <span className="text-[9px] text-slate-400 font-normal">{currency}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 animate-pulse">
                    LOADING BALANCE...
                  </div>
                )
              ) : (
                <Link
                  href="/dashboard/settings"
                  className="text-[10px] text-cyber-red font-bold hover:underline"
                >
                  [ KEY CONFIGURE REQUIRED ]
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs transition-all relative border border-transparent ${
                    isActive
                      ? "bg-cyber-green/5 text-cyber-green border-cyber-green/10"
                      : "hover:bg-cyber-input hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-cyber-green rounded-r"></span>
                  )}
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyber-green" : "text-slate-400 group-hover:text-white"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-cyber-border space-y-2">
          {/* Live system state */}
          <div className="flex items-center justify-between text-[9px] text-slate-500 px-3">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-cyber-blue animate-pulse" />
              NODE PROXIES
            </span>
            <span className="text-cyber-green font-bold">ONLINE</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-xs text-cyber-red hover:bg-cyber-red/10 border border-transparent hover:border-cyber-red/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-cyber-red" />
            <span>DISCONNECT NODE</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-cyber-bg relative z-10">
        {/* Top Header info */}
        <header className="h-16 border-b border-cyber-border px-8 flex items-center justify-between shrink-0 bg-cyber-card/20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-cyber-green" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              SYSTEM CONSOLE // {pathname.replace("/dashboard", "").replace("/", "") || "MAIN"}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            IP: <span className="text-cyber-blue">127.0.0.1</span> | SECURE TUNNEL
          </div>
        </header>

        {/* Child Components Workspace */}
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
