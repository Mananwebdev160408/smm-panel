"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Key, Eye, EyeOff, ShieldCheck, Sparkles, Activity } from "lucide-react";

export default function SettingsPage() {
  const { apiKey, updateUserApiKey } = useAuth();
  const [inputKey, setInputKey] = useState(apiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "Ready to sync SMM API key.",
  ]);

  const addLog = (log: string) => {
    setConsoleLogs((prev) => [...prev, log]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setStatus("error");
      setErrorMessage("API key cannot be empty");
      addLog("[Error] Failed to save: API key cannot be empty.");
      return;
    }

    setStatus("testing");
    addLog(`[Request] Verifying SMM API credentials...`);
    setErrorMessage("");

    try {
      // Test the API key by requesting the user balance
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "balance", key: inputKey.trim() }),
      });

      const data = await res.json();

      if (data && data.balance !== undefined) {
        addLog(`[Success] Verified. Account balance detected: $${data.balance} ${data.currency}`);
        addLog(`[Sync] Storing SMM API key securely...`);
        
        await updateUserApiKey(inputKey.trim());
        
        addLog(`[Success] SMM API configuration updated successfully.`);
        setStatus("success");
      } else {
        const errMsg = data?.error || "Key validation failed (unauthorized).";
        addLog(`[Error] Verification failed: ${errMsg}`);
        setStatus("error");
        setErrorMessage(errMsg);
      }
    } catch (err: unknown) {
      console.error(err);
      addLog(`[Error] Connection terminated unexpectedly.`);
      setStatus("error");
      setErrorMessage("Network error occurred. Try again.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl font-sans">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
          API Configuration
        </h1>
        <p className="text-sm text-slate-450 mt-1">
          Configure your SMM panel API key to fetch balance, view catalog, and place orders.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Settings form card */}
        <div className="md:col-span-3 bg-cyber-card border border-cyber-border rounded-xl p-6 relative overflow-hidden shadow-2xl">
          {/* Top visual helper */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-blue"></div>

          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
            <Key className="w-5 h-5 text-cyber-blue" />
            API Credentials
          </h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Private API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  required
                  placeholder="Paste your SMM API key here..."
                  className="w-full bg-cyber-input/60 border border-cyber-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyber-blue transition-all pr-11"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  disabled={status === "testing"}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                Your key is stored securely in Firestore and is only proxied server-side to protect your SMM panel credentials.
              </p>
            </div>

            {status === "success" && (
              <div className="p-3.5 bg-cyber-green/10 border border-cyber-green/20 rounded-lg text-cyber-green text-xs flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>API key successfully validated and saved.</span>
              </div>
            )}

            {status === "error" && (
              <div className="p-3.5 bg-cyber-red/10 border border-cyber-red/20 rounded-lg text-cyber-red text-xs flex items-center gap-2">
                <span>Error: {errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "testing"}
              className="bg-cyber-purple hover:bg-cyber-blue text-black font-extrabold text-sm py-2.5 px-5 rounded-lg transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 hover:shadow-[0_0_15px_rgba(247,151,29,0.3)]"
            >
              {status === "testing" ? (
                <>
                  <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Validating Key...
                </>
              ) : (
                <>
                  Validate & Save Key
                  <Sparkles className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sync Console status */}
        <div className="md:col-span-2 bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-2xl h-[280px] md:h-auto">
          <div>
            <div className="flex items-center gap-2.5 border-b border-cyber-border pb-3 mb-3">
              <Activity className="w-4.5 h-4.5 text-cyber-blue animate-pulse" />
              <span className="text-xs font-semibold text-slate-350 tracking-wider uppercase">Sync Activity Log</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed overflow-y-auto max-h-[220px] pr-1 text-slate-400">
              {consoleLogs.map((log, idx) => (
                <div key={idx} className="terminal-line text-slate-300 font-sans">
                  {log}
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-cyber-border pt-3 mt-3 text-xs text-slate-500 space-y-0.5 font-semibold">
            <p>Database: <span className="text-cyber-green">Connected</span></p>
            <p>Backup: <span className="text-cyber-purple">Active</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
