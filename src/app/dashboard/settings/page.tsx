"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Key, Eye, EyeOff, ShieldCheck, ShieldAlert, Sparkles, Terminal } from "lucide-react";

export default function SettingsPage() {
  const { apiKey, updateUserApiKey } = useAuth();
  const [inputKey, setInputKey] = useState(apiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "READY TO SYNC API GATEWAY...",
  ]);

  const addLog = (log: string) => {
    setConsoleLogs((prev) => [...prev, log]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setStatus("error");
      setErrorMessage("API key cannot be empty");
      addLog("[ERROR] FAILED TO SAVE: EMPTY KEY PACKET.");
      return;
    }

    setStatus("testing");
    addLog(`[PING] TESTING CREDENTIAL HANDSHAKE WITH SMM PANEL SERVER...`);
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
        addLog(`[HANDSHAKE SUCCESS] CURRENT BALANCE DETECTED: $${data.balance} ${data.currency}`);
        addLog(`[FIRESTORE WRITE] SYNCING API KEY SECURELY TO CLOUD STORE...`);
        
        await updateUserApiKey(inputKey.trim());
        
        addLog(`[SYNC COMPLETE] NODE LINK ESTABLISHED.`);
        setStatus("success");
      } else {
        const errMsg = data?.error || "Key validation failed (unauthorized).";
        addLog(`[HANDSHAKE REJECTED] SERVER REPLIED: ${errMsg}`);
        setStatus("error");
        setErrorMessage(errMsg);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`[FATAL ERROR] API CONNECTOR TERMINATED UNEXPECTEDLY.`);
      setStatus("error");
      setErrorMessage("Network error occurred. Try again.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
          API GATEWAY CONFIGURATION
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
          Establish encrypted communication links to BuzzPlusSMM servers
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Settings form card */}
        <div className="md:col-span-3 bg-cyber-card border border-cyber-border rounded-lg p-6 relative overflow-hidden shadow-2xl">
          {/* Top visual helper */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-blue"></div>

          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-cyber-blue" />
            BuzzPlusSMM Credentials
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Your Private API Token
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  required
                  placeholder="Paste your API key here..."
                  className="w-full bg-cyber-input border border-cyber-border rounded px-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyber-blue transition-all pr-10"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  disabled={status === "testing"}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 leading-normal">
                Never share this token. It is stored securely on Firestore DB under your authenticated identity and sent only from Next.js server context to prevent sniffing.
              </p>
            </div>

            {status === "success" && (
              <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded text-cyber-green text-xs flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>LINK SECURED: API KEY SYNCED AND VALIDATED.</span>
              </div>
            )}

            {status === "error" && (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded text-cyber-red text-xs flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>[GATEWAY ERROR]: {errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "testing"}
              className="bg-cyber-blue hover:bg-cyber-blue hover:shadow-[0_0_15px_rgba(0,240,255,0.25)] text-black font-extrabold text-xs py-2 px-4 rounded tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {status === "testing" ? (
                <>
                  <div className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  LINKING GATEWAY...
                </>
              ) : (
                <>
                  VALIDATE & SAVE LINK
                  <Sparkles className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sync Console status */}
        <div className="md:col-span-2 bg-cyber-card border border-cyber-border rounded-lg p-5 font-mono flex flex-col justify-between shadow-2xl h-[280px] md:h-auto">
          <div>
            <div className="flex items-center gap-2 border-b border-cyber-border pb-2 mb-3">
              <Terminal className="w-4 h-4 text-cyber-blue animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">GATEWAY-BRIDGE.LOG</span>
            </div>
            <div className="space-y-1.5 text-[10px] leading-relaxed overflow-y-auto max-h-[220px] pr-1">
              {consoleLogs.map((log, idx) => (
                <div key={idx} className="terminal-line text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-cyber-border pt-2.5 mt-3 text-[9px] text-slate-500">
            <p>FIREBASE DB: <span className="text-cyber-green font-bold">CONNECTED</span></p>
            <p>CREDENTIAL CLOUD BACKUP: <span className="text-cyber-purple font-bold">ACTIVE</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
