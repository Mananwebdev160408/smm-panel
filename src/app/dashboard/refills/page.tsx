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
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RotateCw, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface RefillLog {
  id: string;
  smmOrderId: number;
  refillId: number;
  status: string;
  serviceName: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
}

export default function RefillsPage() {
  const { apiKey, user } = useAuth();
  const [refills, setRefills] = useState<RefillLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const refillsRef = collection(db, "refills");
    const q = query(
      refillsRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: RefillLog[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() } as RefillLog);
        });
        setRefills(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch refills:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const syncRefillStatus = async (refillLog: RefillLog) => {
    if (!apiKey) return;
    setSyncingId(refillLog.id);
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refill_status",
          key: apiKey,
          refill: refillLog.refillId,
        }),
      });
      const data = await res.json();

      let status = "Pending";
      if (data && data.status) {
        if (data.status.error) {
          status = "Rejected"; // Or data.status.error
          toast.error(`Refill #${refillLog.refillId} failed/rejected.`);
        } else {
          status = data.status;
          toast.success(`Refill #${refillLog.refillId} is ${status}.`);
        }
        
        const docRef = doc(db, "refills", refillLog.id);
        await updateDoc(docRef, { status });
      } else {
        toast.error("Failed to parse API response.");
      }
    } catch (err) {
      console.error("Error syncing refill:", err);
      toast.error("Network error while syncing refill.");
    } finally {
      setSyncingId(null);
    }
  };

  const syncAllPending = async () => {
    if (!apiKey) return;
    const pendingRefills = refills.filter((r) => r.status.toLowerCase() === "pending" || r.status.toLowerCase() === "in progress");
    if (pendingRefills.length === 0) return;

    const refillIds = pendingRefills.map((r) => r.refillId).join(",");
    
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refill_status",
          key: apiKey,
          refills: refillIds,
        }),
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        let syncedCount = 0;
        for (const log of pendingRefills) {
          const result = data.find((d) => String(d.refill) === String(log.refillId));
          if (result && result.status) {
             let newStatus = "Pending";
             if (result.status.error) {
               newStatus = "Rejected";
             } else {
               newStatus = result.status;
             }
             if (newStatus !== log.status) {
                const docRef = doc(db, "refills", log.id);
                await updateDoc(docRef, { status: newStatus });
                syncedCount++;
             }
          }
        }
        if (syncedCount > 0) {
          toast.success(`Updated ${syncedCount} pending refill(s).`);
        } else {
          toast("No changes in pending refills.", { icon: "ℹ️" });
        }
      } else {
        toast.error("Failed to parse API response.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while syncing bulk refills.");
    }
  };

  if (!apiKey) {
    return (
      <div className="space-y-6 max-w-3xl font-sans">
        <div className="bg-cyber-card border border-cyber-red/20 rounded-xl p-8 text-center space-y-4 shadow-lg">
          <AlertCircle className="w-12 h-12 text-cyber-red mx-auto animate-pulse" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            API Key Required
          </h2>
          <Link href="/dashboard/settings" className="inline-block bg-cyber-red hover:bg-cyber-red/90 text-white font-bold text-xs py-3 px-6 rounded-lg tracking-wider transition-all">
            Configure API Key
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("completed")) {
      return <span className="bg-cyber-green/10 text-cyber-green border border-cyber-green/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Completed</span>;
    } else if (s.includes("rejected") || s.includes("error") || s.includes("canceled")) {
      return <span className="bg-cyber-red/10 text-cyber-red border border-cyber-red/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Rejected</span>;
    }
    return <span className="bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{status}</span>;
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <RotateCw className="w-6 h-6 text-cyber-blue" />
            Refill Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track the status of your requested order refills.
          </p>
        </div>
        <button
          onClick={syncAllPending}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cyber-card border border-cyber-border rounded-lg text-sm text-slate-200 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Sync Pending Refills
        </button>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-xl shadow-sm overflow-hidden p-6">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400 animate-pulse">Loading refill history...</div>
        ) : refills.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <RotateCw className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-medium text-slate-300">No refills requested yet.</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-bg/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-4">DATE</th>
                  <th className="py-4 px-4">SMM ORDER ID</th>
                  <th className="py-4 px-4">REFILL ID</th>
                  <th className="py-4 px-4">SERVICE</th>
                  <th className="py-4 px-4 text-center">STATUS</th>
                  <th className="py-4 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/50 text-slate-200">
                {refills.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-4 text-slate-400 whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-4 px-4 font-mono text-white font-semibold">#{r.smmOrderId}</td>
                    <td className="py-4 px-4 font-mono text-cyber-blue font-semibold">#{r.refillId}</td>
                    <td className="py-4 px-4 text-xs font-semibold">{r.serviceName}</td>
                    <td className="py-4 px-4 text-center">{getStatusBadge(r.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => syncRefillStatus(r)}
                        disabled={syncingId === r.id}
                        className="inline-flex p-1.5 hover:bg-cyber-blue/10 hover:text-cyber-blue border border-transparent hover:border-cyber-blue/20 rounded transition-all cursor-pointer"
                        title="Sync Status"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingId === r.id ? "animate-spin text-cyber-blue" : "text-slate-400"}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
