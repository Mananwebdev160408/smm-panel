"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Search, List, RefreshCw } from "lucide-react";

interface SMMService {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill: boolean;
  cancel: boolean;
}

export default function ServicesPage() {
  const { apiKey } = useAuth();
  const [services, setServices] = useState<SMMService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "services", key: apiKey }),
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        setServices(data);
        const cats = Array.from(new Set(data.map((s: SMMService) => s.category || "Uncategorized"))) as string[];
        setCategories(cats.sort());
        if (cats.length > 0) {
          setSelectedCategory(cats[0]);
        }
      } else {
        setError(data?.error || "Failed to load services list.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServices();
  }, [apiKey, fetchServices]);

  if (!apiKey) {
    return (
      <div className="p-6 text-center text-slate-400">
        Please configure your API key to view the services catalog.
      </div>
    );
  }

  const filteredServices = services.filter((s) => {
    const matchesCat = selectedCategory ? s.category === selectedCategory : true;
    const matchesSearch = searchQuery
      ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.service.toString().includes(searchQuery)
      : true;
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <List className="w-6 h-6 text-cyber-purple" />
            Services Catalog
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse live pricing and availability across all SMM categories.
          </p>
        </div>
        <button
          onClick={fetchServices}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-cyber-card border border-cyber-border rounded-lg text-sm text-slate-200 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyber-purple" : ""}`} />
          Refresh Catalog
        </button>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <select
          className="w-full md:w-auto bg-cyber-input border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyber-purple transition-all"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={loading}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ID or Name..."
            className="w-full bg-cyber-input border border-cyber-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyber-purple transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-sm text-slate-400 animate-pulse">
            Loading real-time catalog...
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-cyber-red">
            {error}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-20 text-sm text-slate-400">
            No services found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-bg/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-6">ID</th>
                  <th className="py-4 px-6 w-1/3">Service</th>
                  <th className="py-4 px-6">Rate (Per 1k)</th>
                  <th className="py-4 px-6">Min / Max</th>
                  <th className="py-4 px-6 text-center">Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/50 text-slate-200">
                {filteredServices.map((s) => (
                  <tr key={s.service} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 font-mono text-slate-400">#{s.service}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white mb-0.5">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.category}</div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-cyber-green">${Number(s.rate).toFixed(3)}</td>
                    <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                      {s.min} <span className="text-slate-600 px-1">/</span> {s.max}
                    </td>
                    <td className="py-4 px-6 text-center space-x-2">
                      {s.refill && (
                        <span className="inline-block bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" title="Refill Supported">
                          ♻️ Refill
                        </span>
                      )}
                      {s.cancel && (
                        <span className="inline-block bg-cyber-red/10 text-cyber-red border border-cyber-red/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" title="Cancel Supported">
                          ❌ Cancel
                        </span>
                      )}
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
