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
  Compass, 
  Clock, 
  ShieldCheck, 
  ExternalLink
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
  createdAt: { seconds: number; nanoseconds: number } | null;
}

export default function DashboardPage() {
  const { apiKey, user } = useAuth();
  
  // Database orders
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Status Checker panel
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState<{ status: string; charge: string; currency?: string; start_count: number; remains: number } | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkLogs, setCheckLogs] = useState<string[]>([
    "Ready. Enter an SMM Order ID to check status.",
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
    addCheckLog(`[Request] Querying SMM status for Order #${checkId.trim()}...`);

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
        addCheckLog(`[Success] Status: ${data.status} | Remaining: ${data.remains} | Cost: $${data.charge}`);
      } else {
        const errMsg = data?.error || "Returned null payload or invalid ID format.";
        addCheckLog(`[Error] Inquiry failed: ${errMsg}`);
      }
    } catch (err: unknown) {
      console.error(err);
      addCheckLog(`[Error] Request timed out.`);
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
        <span className="bg-cyber-green/10 border border-cyber-green/20 text-cyber-green text-xs font-semibold px-2.5 py-1 rounded-full uppercase">
          Completed
        </span>
      );
    } else if (s.includes("progress")) {
      return (
        <span className="bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue text-xs font-semibold px-2.5 py-1 rounded-full uppercase">
          In Progress
        </span>
      );
    } else if (s.includes("partial")) {
      return (
        <span className="bg-cyber-yellow/10 border border-cyber-yellow/20 text-cyber-yellow text-xs font-semibold px-2.5 py-1 rounded-full uppercase">
          Partial
        </span>
      );
    } else if (s.includes("cancel")) {
      return (
        <span className="bg-cyber-red/10 border border-cyber-red/20 text-cyber-red text-xs font-semibold px-2.5 py-1 rounded-full uppercase">
          Cancelled
        </span>
      );
    } else {
      return (
        <span className="bg-slate-800 border border-slate-700 text-slate-450 text-xs font-semibold px-2.5 py-1 rounded-full uppercase">
          {status}
        </span>
      );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Stats Tickers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Stat card 1 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-green"></div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Orders
          </span>
          <span className="text-3xl font-extrabold text-white mt-1.5">
            {totalOrders}
          </span>
          <span className="text-xs text-slate-500 mt-2">
            Synced with database history
          </span>
        </div>

        {/* Stat card 2 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-purple"></div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Campaigns
          </span>
          <span className="text-3xl font-extrabold text-white mt-1.5">
            {uniqueBatches}
          </span>
          <span className="text-xs text-slate-500 mt-2">
            Batched campaign orders executed
          </span>
        </div>

        {/* Stat card 3 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 bottom-0 bg-cyber-blue"></div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Charges
          </span>
          <span className="text-3xl font-extrabold text-cyber-green glow-green mt-1.5">
            $ {totalSpent}
          </span>
          <span className="text-xs text-slate-500 mt-2">
            All-time API budget spent
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Orders history Table (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-purple"></div>
            
            <div className="flex items-center justify-between border-b border-cyber-border pb-4 mb-5">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyber-purple" />
                Recent SMM Orders
              </h2>
            </div>

            {loadingOrders ? (
              <div className="text-center py-12 text-sm text-slate-400 animate-pulse">
                Loading order history...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <Compass className="w-12 h-12 text-slate-550 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Orders Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  You haven&apos;t placed any SMM orders yet. Head over to the Place Orders tab to launch your first SMM campaign.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-cyber-border text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3">DATE</th>
                        <th className="py-3 px-3">CAMPAIGN</th>
                        <th className="py-3 px-3">SMM ID</th>
                        <th className="py-3 px-3">SERVICE</th>
                        <th className="py-3 px-3">LINK</th>
                        <th className="py-3 px-3 text-right">QTY</th>
                        <th className="py-3 px-3 text-right">COST</th>
                        <th className="py-3 px-3 text-center">STATUS</th>
                        <th className="py-3 px-3 text-center">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyber-border/40 text-slate-300">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                          {/* Date */}
                          <td className="py-4 px-3 text-slate-400 whitespace-nowrap">
                            {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                          </td>
                          {/* Campaign/Batch ID */}
                          <td className="py-4 px-3 text-cyber-purple font-semibold">
                            {order.batchId}
                          </td>
                          {/* SMM ID */}
                          <td className="py-4 px-3 text-slate-200 font-semibold">
                            #{order.smmOrderId}
                          </td>
                          {/* Service name */}
                          <td className="py-4 px-3 font-medium max-w-[130px] truncate" title={order.serviceName}>
                            {order.serviceName}
                          </td>
                          {/* Target link */}
                          <td className="py-4 px-3 max-w-[110px] truncate text-cyber-blue hover:underline">
                            <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                              Link <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                          {/* Qty */}
                          <td className="py-4 px-3 text-right text-slate-300 font-medium">
                            {order.quantity}
                          </td>
                          {/* Cost */}
                          <td className="py-4 px-3 text-right text-cyber-green font-semibold">
                            ${Number(order.charge).toFixed(4)}
                          </td>
                          {/* Status badge */}
                          <td className="py-4 px-3 text-center">
                            {getStatusBadge(order.status)}
                          </td>
                          {/* Individual actions */}
                          <td className="py-4 px-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => syncOrderStatus(order)}
                                disabled={syncingId === order.id}
                                className="p-1.5 hover:bg-cyber-blue/10 hover:text-cyber-blue border border-transparent hover:border-cyber-blue/20 rounded-lg transition-all cursor-pointer"
                                title="Refresh Order Status"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncingId === order.id ? "animate-spin text-cyber-blue" : "text-slate-400"}`} />
                              </button>
                              <button
                                onClick={() => triggerRefill(order)}
                                disabled={syncingId === order.id}
                                className="p-1.5 hover:bg-cyber-green/10 hover:text-cyber-green border border-transparent hover:border-cyber-green/20 rounded-lg transition-all cursor-pointer"
                                title="Request Refill"
                              >
                                <ShieldCheck className="w-4 h-4 text-slate-400 hover:text-cyber-green transition-colors" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="block md:hidden space-y-4">
                  {orders.map((order) => (
                    <div 
                      key={order.id} 
                      className="bg-cyber-input/40 border border-cyber-border rounded-xl p-4 space-y-3 shadow-lg relative overflow-hidden"
                    >
                      {/* Top bar with ID, Date, and Campaign */}
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-wider pb-2 border-b border-cyber-border/40">
                        <div>
                          ID: <span className="text-white">#{order.smmOrderId}</span>
                        </div>
                        <div>
                          Campaign: <span className="text-cyber-purple font-bold">{order.batchId}</span>
                        </div>
                        <div>
                          {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                        </div>
                      </div>

                      {/* Service name */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-cyber-blue font-semibold uppercase tracking-wider">
                          {order.serviceCategory}
                        </div>
                        <h4 className="text-xs font-bold text-white leading-snug">
                          {order.serviceName}
                        </h4>
                      </div>

                      {/* Qty, Cost & Link */}
                      <div className="grid grid-cols-3 gap-2 py-1 text-[11px] text-slate-400 font-medium">
                        <div>
                          <div className="text-[9px] text-slate-550 uppercase tracking-widest font-bold">Quantity</div>
                          <div className="text-slate-200 font-mono mt-0.5">{order.quantity}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-555 uppercase tracking-widest font-bold">Cost</div>
                          <div className="text-cyber-green font-mono font-semibold mt-0.5">${Number(order.charge).toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-555 uppercase tracking-widest font-bold">Link</div>
                          <a 
                            href={order.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-cyber-blue hover:underline inline-flex items-center gap-0.5 mt-0.5"
                          >
                            Target <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Status and Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-cyber-border/40">
                        <div>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => syncOrderStatus(order)}
                            disabled={syncingId === order.id}
                            className="bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/20 rounded px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Refresh Status"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === order.id ? "animate-spin" : ""}`} />
                            Sync
                          </button>
                          <button
                            onClick={() => triggerRefill(order)}
                            disabled={syncingId === order.id}
                            className="bg-cyber-green/10 hover:bg-cyber-green/20 text-cyber-green border border-cyber-green/20 rounded px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Request Refill"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Refill
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Live ID Status checker (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Check card */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-blue"></div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyber-blue" />
              Check Order Status
            </h2>

            <form onSubmit={handleCheckStatus} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-405 uppercase tracking-wider block">
                  SMM Order ID
                </label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Enter SMM Order ID..."
                    className="flex-1 bg-cyber-input/60 border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyber-blue transition-all"
                    value={checkId}
                    onChange={(e) => setCheckId(e.target.value)}
                    disabled={checkLoading}
                  />
                  <button
                    type="submit"
                    disabled={checkLoading || !checkId.trim()}
                    className="bg-cyber-blue hover:bg-cyber-blue/90 text-white font-bold text-sm px-5 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                  >
                    {checkLoading ? "..." : "Check"}
                  </button>
                </div>
              </div>
            </form>

            {/* Check Results Panel */}
            {checkResult && (
              <div className="mt-5 p-4 bg-cyber-input/60 border border-cyber-border rounded-lg space-y-3 text-xs text-slate-200">
                <div className="flex items-center gap-2 border-b border-cyber-border pb-2 font-bold uppercase text-slate-300">
                  <Activity className="w-4 h-4 text-cyber-green animate-pulse" />
                  Order Details Found
                </div>
                <div className="grid grid-cols-2 gap-3 text-slate-400">
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

          {/* Live Checker logs console */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg h-[240px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-cyber-border pb-3 mb-3">
                <Activity className="w-4.5 h-4.5 text-cyber-blue animate-pulse" />
                <span className="text-xs font-semibold text-slate-350 tracking-wider uppercase">Inquiry Activity Log</span>
              </div>
              <div className="space-y-2 text-xs leading-relaxed overflow-y-auto max-h-[130px] pr-1 text-slate-400">
                {checkLogs.map((log, idx) => (
                  <div key={idx} className="terminal-line text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-slate-550 text-right pt-2 border-t border-cyber-border">
              Gateway Route: /api/smm
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
