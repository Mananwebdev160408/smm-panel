"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Activity, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Compass, 
  Clock, 
  ShieldCheck, 
  Terminal,
  ExternalLink,
  ChevronRight
} from "lucide-react";

interface OrderLog {
  id: string;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  serviceType: string;
  link: string;
  quantity: number;
  smmOrderId: number;
  batchId: string;
  status: string;
  charge: string;
  remains: number;
  createdAt: any;
}

export default function DashboardPage() {
  const { apiKey, user } = useAuth();
  
  // Database orders
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Status Checker panel
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkLogs, setCheckLogs] = useState<string[]>([
    "STATUS MONITOR STANDBY. WAITING FOR ID INPUT...",
  ]);

  const addCheckLog = (log: string) => {
    setCheckLogs((prev) => [...prev, log]);
  };

  // Sync state for individual orders
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Real-time listener for user orders from Firestore
  useEffect(() => {
    if (!user) return;

    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: OrderLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetched.push({
          id: doc.id,
          ...data,
        } as OrderLog);
      });
      setOrders(fetched);
      setLoadingOrders(false);
    }, (error) => {
      console.error("Error reading Firestore orders:", error);
      setLoadingOrders(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Check status of custom order by ID
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkId.trim()) return;

    setCheckLoading(true);
    setCheckResult(null);
    addCheckLog(`[QUERY] FETCHING LIVE SMM STATUS FOR ID: ${checkId.trim()}...`);

    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          key: apiKey || "",
          order: Number(checkId.trim()) || checkId.trim() // handles single numeric order ID
        })
      });
      const data = await res.json();

      if (data && !data.error) {
        setCheckResult(data);
        addCheckLog(`[LIVE DATA] STATUS: ${data.status} | REMAINS: ${data.remains} | CHARGE: $${data.charge}`);
      } else {
        const errMsg = data?.error || "Returned null payload or invalid ID format.";
        addCheckLog(`[SMM ERROR] INQUIRY REJECTED: ${errMsg}`);
      }
    } catch (err: any) {
      console.error(err);
      addCheckLog(`[FATAL ERROR] INQUIRY TIMED OUT.`);
    } finally {
      setCheckLoading(false);
    }
  };

  // Sync/Refresh status of a saved order in Firestore
  const syncOrderStatus = async (order: OrderLog) => {
    if (!apiKey) return;
    setSyncingId(order.id);
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          key: apiKey,
          order: order.smmOrderId
        })
      });
      const data = await res.json();

      if (data && !data.error) {
        // Update Firestore
        const docRef = doc(db, "orders", order.id);
        await updateDoc(docRef, {
          status: data.status || "Pending",
          charge: data.charge || "0.00",
          remains: Number(data.remains) || 0
        });
      } else {
        console.error("Failed to sync order:", data?.error);
      }
    } catch (err) {
      console.error("Error syncing order status:", err);
    } finally {
      setSyncingId(null);
    }
  };

  // Trigger SMM refill for a completed/partial order
  const triggerRefill = async (order: OrderLog) => {
    if (!apiKey) return;
    if (!confirm(`Are you sure you want to request a refill for Order #${order.smmOrderId}?`)) return;

    setSyncingId(order.id);
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refill",
          key: apiKey,
          order: order.smmOrderId
        })
      });
      const data = await res.json();

      if (data && data.refill) {
        alert(`Refill request placed successfully. Refill ID: ${data.refill}`);
      } else {
        alert(`Refill request failed: ${data?.error || "Not supported for this service."}`);
      }
    } catch (err) {
      console.error("Refill error:", err);
      alert("Refill bridge timed out.");
    } finally {
      setSyncingId(null);
    }
  };

  // Calculations for stats
  const totalOrders = orders.length;
  const uniqueBatches = Array.from(new Set(orders.map(o => o.batchId))).length;
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.charge) || 0), 0).toFixed(4);

  // Status color mapper
  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("completed")) {
      return (
        <span className="bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-[9px] font-bold px-2 py-0.5 rounded uppercase">
          Completed
        </span>
      );
    } else if (s.includes("progress")) {
      return (
        <span className="bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue text-[9px] font-bold px-2 py-0.5 rounded uppercase animate-pulse">
          In Progress
        </span>
      );
    } else if (s.includes("partial")) {
      return (
        <span className="bg-cyber-yellow/10 border border-cyber-yellow/20 text-cyber-yellow text-[9px] font-bold px-2 py-0.5 rounded uppercase">
          Partial
        </span>
      );
    } else if (s.includes("cancel")) {
      return (
        <span className="bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-[9px] font-bold px-2 py-0.5 rounded uppercase">
          Cancelled
        </span>
      );
    } else {
      return (
        <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
          {status}
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Stats Tickers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Stat card 1 */}
        <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 flex flex-col justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-green rounded-l"></div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Total Orders Placed
          </span>
          <span className="text-3xl font-extrabold text-white mt-1 font-mono">
            {totalOrders}
          </span>
          <span className="text-[9px] text-slate-600 mt-2 uppercase">
            Logged across Firestore nodes
          </span>
        </div>

        {/* Stat card 2 */}
        <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 flex flex-col justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-purple rounded-l"></div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Multi-Order Campaigns
          </span>
          <span className="text-3xl font-extrabold text-white mt-1 font-mono">
            {uniqueBatches}
          </span>
          <span className="text-[9px] text-slate-600 mt-2 uppercase">
            Parallel batch actions executed
          </span>
        </div>

        {/* Stat card 3 */}
        <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 flex flex-col justify-between shadow-lg relative">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-blue rounded-l"></div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Accumulated API Charges
          </span>
          <span className="text-3xl font-extrabold text-cyber-green glow-green mt-1 font-mono">
            $ {totalSpent}
          </span>
          <span className="text-[9px] text-slate-600 mt-2 uppercase">
            Aggregate cost of active jobs
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Orders history Table (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-purple"></div>
            
            <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyber-purple" />
                Firestore Order Log Stream
              </h2>
            </div>

            {loadingOrders ? (
              <div className="text-center py-12 text-xs text-slate-500 animate-pulse font-mono">
                DECRYPTING CLOUD TRANSCRIPTS...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Compass className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Logged Transactions</h3>
                <p className="text-[10px] text-slate-600 max-w-xs mx-auto leading-relaxed">
                  You have not placed any orders yet. Navigate to the Multi-Order page to launch your first SMM campaign packet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-cyber-border text-slate-500">
                      <th className="py-2.5 px-2">DATE</th>
                      <th className="py-2.5 px-2">CAMPAIGN</th>
                      <th className="py-2.5 px-2">SMM ID</th>
                      <th className="py-2.5 px-2">SERVICE</th>
                      <th className="py-2.5 px-2">TARGET LINK</th>
                      <th className="py-2.5 px-2 text-right">QTY</th>
                      <th className="py-2.5 px-2 text-right">COST</th>
                      <th className="py-2.5 px-2 text-center">STATUS</th>
                      <th className="py-2.5 px-2 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/40">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-cyber-input/10 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">
                          {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                        </td>
                        {/* Campaign/Batch ID */}
                        <td className="py-3 px-2 text-cyber-purple font-bold">
                          {order.batchId}
                        </td>
                        {/* SMM ID */}
                        <td className="py-3 px-2 text-white font-bold">
                          #{order.smmOrderId}
                        </td>
                        {/* Service name */}
                        <td className="py-3 px-2 font-bold max-w-[120px] truncate" title={order.serviceName}>
                          {order.serviceName}
                        </td>
                        {/* Target link */}
                        <td className="py-3 px-2 max-w-[100px] truncate text-cyber-blue hover:underline">
                          <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            Link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </td>
                        {/* Qty */}
                        <td className="py-3 px-2 text-right text-slate-300">
                          {order.quantity}
                        </td>
                        {/* Cost */}
                        <td className="py-3 px-2 text-right text-cyber-green">
                          ${Number(order.charge).toFixed(4)}
                        </td>
                        {/* Status badge */}
                        <td className="py-3 px-2 text-center">
                          {getStatusBadge(order.status)}
                        </td>
                        {/* Individual actions */}
                        <td className="py-3 px-2 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => syncOrderStatus(order)}
                              disabled={syncingId === order.id}
                              className="p-1 hover:bg-cyber-blue/10 hover:text-cyber-blue border border-transparent hover:border-cyber-blue/20 rounded transition-all cursor-pointer"
                              title="Sync SMM Live Status"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === order.id ? "animate-spin text-cyber-blue" : "text-slate-400"}`} />
                            </button>
                            <button
                              onClick={() => triggerRefill(order)}
                              disabled={syncingId === order.id}
                              className="p-1 hover:bg-cyber-green/10 hover:text-cyber-green border border-transparent hover:border-cyber-green/20 rounded transition-all cursor-pointer"
                              title="Request Refill"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live ID Status checker (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Check card */}
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-blue"></div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyber-blue" />
              SMM Live Node Checker
            </h2>

            <form onSubmit={handleCheckStatus} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  ORDER ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter BuzzPlus Order ID..."
                    className="flex-1 bg-cyber-input border border-cyber-border rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyber-blue"
                    value={checkId}
                    onChange={(e) => setCheckId(e.target.value)}
                    disabled={checkLoading}
                  />
                  <button
                    type="submit"
                    disabled={checkLoading || !checkId.trim()}
                    className="bg-cyber-blue hover:bg-cyber-blue hover:shadow-[0_0_12px_rgba(0,240,255,0.2)] text-black font-extrabold text-xs px-4 rounded tracking-wider cursor-pointer transition-all disabled:opacity-50"
                  >
                    {checkLoading ? "..." : "QUERY"}
                  </button>
                </div>
              </div>
            </form>

            {/* Check Results Panel */}
            {checkResult && (
              <div className="mt-4 p-3 bg-cyber-input border border-cyber-border rounded space-y-2 font-mono text-[10px] text-slate-200">
                <div className="flex items-center gap-1.5 border-b border-cyber-border pb-1.5 font-bold uppercase">
                  <Activity className="w-3.5 h-3.5 text-cyber-green animate-pulse" />
                  RESPONSE PACKET RECEIVED
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div>Live Status:</div>
                  <div className="text-white font-bold">{checkResult.status}</div>
                  
                  <div>Charge Rate:</div>
                  <div className="text-cyber-green font-bold">${checkResult.charge} {checkResult.currency}</div>
                  
                  <div>Start Count:</div>
                  <div className="text-white">{checkResult.start_count}</div>
                  
                  <div>Remaining Count:</div>
                  <div className="text-cyber-blue font-bold">{checkResult.remains}</div>
                </div>
              </div>
            )}
          </div>

          {/* Live Checker terminal logger console */}
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 font-mono shadow-lg h-[240px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-cyber-border pb-2.5 mb-2.5">
                <Terminal className="w-4 h-4 text-cyber-blue animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">CHECKER-BRIDGE.LOG</span>
              </div>
              <div className="space-y-1.5 text-[9px] leading-relaxed overflow-y-auto max-h-[140px] pr-1">
                {checkLogs.map((log, idx) => (
                  <div key={idx} className="terminal-line text-slate-400">
                    {log}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[8px] text-slate-600 text-right pt-2 border-t border-cyber-border">
              SMM PANEL URL: v2/status proxy
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
