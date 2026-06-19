"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Activity, Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function AuthPage() {
  const { user, loading, signInUser, signUpUser } = useAuth();
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Status logs for system info panel
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "Initializing secure session...",
    "Connecting API gateways...",
  ]);

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const logs = [
      "Optimizing network routes...",
      "Syncing SMM catalog configurations...",
      "Secure connection established. Ready.",
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setSystemLogs((prev) => [...prev, logs[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-cyber-bg font-sans text-cyber-purple">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-cyber-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="animate-pulse text-base tracking-wide text-slate-300">Setting up secure session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAuthLoading(true);

    try {
      if (isLogin) {
        setSystemLogs((prev) => [...prev, `Authenticating user: ${email}...`]);
        await signInUser(email, password);
        setSystemLogs((prev) => [...prev, "Sign in successful. Redirecting to dashboard..."]);
      } else {
        setSystemLogs((prev) => [...prev, `Creating SMM account for: ${email}...`]);
        await signUpUser(email, password);
        setSystemLogs((prev) => [...prev, "Account successfully registered. Welcome!"]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Authentication failed. Please verify your credentials.");
      setSystemLogs((prev) => [...prev, `[Error] Authentication rejected.`]);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-cyber-bg cyber-grid relative select-none">
      {/* Soft gradient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-purple/10 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full filter blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-4xl grid md:grid-cols-5 gap-6 z-10">
        
        {/* Modern Info panel */}
        <div className="md:col-span-2 bg-cyber-card/90 border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] h-[320px] md:h-auto">
          <div>
            <div className="flex items-center gap-2.5 border-b border-cyber-border pb-3 mb-4">
              <Activity className="w-5 h-5 text-cyber-purple animate-pulse" />
              <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">System Status</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-400 overflow-y-auto max-h-[300px] pr-1 leading-relaxed">
              {systemLogs.map((log, idx) => (
                <div key={idx} className="terminal-line text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-cyber-border pt-4 mt-4 text-xs text-slate-500 space-y-1">
            <p>Platform Version: <span className="text-cyber-blue font-semibold">v2.0.0</span></p>
            <p>API Endpoint: <span className="text-cyber-green font-semibold">buzzplussmm.com</span></p>
          </div>
        </div>

        {/* Main Auth Form Card */}
        <div className="md:col-span-3 bg-cyber-card/90 border border-cyber-border rounded-xl p-6 md:p-8 flex flex-col justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Top gradient highlight line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyber-purple via-cyber-blue to-cyber-green"></div>

          <div className="text-center md:text-left mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center md:justify-start gap-2">
              BuzzPlus<span className="text-cyber-purple glow-purple">SMM</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Secure SMM Campaign Management Platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/20 rounded-lg text-cyber-red text-xs">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full bg-cyber-input/60 border border-cyber-border rounded-lg pl-11 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyber-purple focus:ring-1 focus:ring-cyber-purple transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-cyber-input/60 border border-cyber-border rounded-lg pl-11 pr-11 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyber-purple focus:ring-1 focus:ring-cyber-purple transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-3 bg-gradient-to-r from-cyber-purple to-cyber-purple/95 hover:from-cyber-purple/95 hover:to-cyber-purple hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] text-white font-bold py-3 px-4 rounded-lg text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Connecting...
                </>
              ) : (
                <>
                  {isLogin ? "Sign In to Dashboard" : "Create SMM Account"}
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-cyber-border pt-4 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-xs text-cyber-blue hover:text-cyber-blue/80 hover:underline transition-all"
            >
              {isLogin 
                ? "Don't have an account? Sign Up" 
                : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
