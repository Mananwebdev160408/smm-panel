"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Layers,
  Plus,
  Trash2,
  Play,
  Search,
  AlertCircle,
  HelpCircle,
  Activity,
} from "lucide-react";
import Link from "next/link";

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

interface CampaignItem {
  id: string; // unique ID in local state
  service: SMMService;
  // Field values depending on type
  quantity?: number;
  comments?: string;
  usernames?: string;
  username?: string;
  answer_number?: string;
  dripEnabled?: boolean;
  runs?: number;
  interval?: number;
}

let idCounter = 0;

export default function MultiOrderPage() {
  const { apiKey, user } = useAuth();

  // SMM Panel Services
  const [services, setServices] = useState<SMMService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Campaign Form State
  const [targetLink, setTargetLink] = useState("");
  const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
  const [executing, setExecuting] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "Campaign creator ready. Please enter a target link.",
  ]);

  const addLog = (log: string) => {
    setConsoleLogs((prev) => [...prev, log]);
  };

  const clampQty = (qty: any, minStr: string, maxStr: string): number => {
    const minVal = Number(minStr) || 10;
    const maxVal = Number(maxStr) || Infinity;
    let val = Number(qty);
    if (isNaN(val) || val < minVal) return minVal;
    if (val > maxVal) return maxVal;
    return val;
  };

  // Helper to compute order quantity for a campaign item
  const getItemQty = (item: CampaignItem): number => {
    const typeLower = item.service.type.toLowerCase();
    const minStr = item.service.min;
    const maxStr = item.service.max;

    // IMPORTANT: check "comment likes" BEFORE "comments" to avoid substring collision
    if (typeLower.includes("comment likes")) {
      return clampQty(item.quantity, minStr, maxStr);
    } else if (typeLower.includes("comments")) {
      // Comments type: each non-empty line is one comment sent
      const commentsList = item.comments
        ? item.comments.split("\n").filter((c) => c.trim().length > 0)
        : [];
      return commentsList.length || 1;
    } else if (typeLower.includes("mentions")) {
      return clampQty(item.quantity, minStr, maxStr);
    } else if (typeLower.includes("poll")) {
      return clampQty(item.quantity, minStr, maxStr);
    } else if (typeLower.includes("package")) {
      return 1;
    } else {
      // Default / Drip-feed:
      // For drip-feed the API receives quantity-per-run; billing is also per-run quantity.
      // Do NOT multiply by runs here — that would inflate the displayed cost.
      return clampQty(item.quantity, minStr, maxStr);
    }
  };

  // Rate from API is already in INR — no conversion needed
  const getItemCostINR = (item: CampaignItem): number => {
    const qty = getItemQty(item);
    const rateINR = Number(item.service.rate) || 0;
    const typeLower = item.service.type.toLowerCase();
    // Package services are flat-rate (not per-1k)
    if (typeLower.includes("package")) {
      return rateINR;
    }
    return (qty / 1000) * rateINR;
  };

  const totalINRCost = campaignItems.reduce(
    (sum, item) => sum + getItemCostINR(item),
    0,
  );

  // Fetch services list
  useEffect(() => {
    const fetchServices = async () => {
      if (!apiKey) return;
      setLoadingServices(true);
      setFetchError("");
      try {
        // Check Firestore Cache First
        const cacheDocRef = doc(db, "services_cache", "global_catalog");
        let useCache = false;
        let cachedData: SMMService[] = [];

        try {
          const cacheDocSnap = await getDoc(cacheDocRef);
          if (cacheDocSnap.exists()) {
            const cacheDocData = cacheDocSnap.data();
            const updatedAt = cacheDocData.updatedAt;
            if (
              updatedAt &&
              Array.isArray(cacheDocData.services) &&
              cacheDocData.services.length > 0
            ) {
              const updatedAtMs =
                typeof updatedAt.toMillis === "function"
                  ? updatedAt.toMillis()
                  : updatedAt.seconds
                    ? updatedAt.seconds * 1000
                    : Number(updatedAt);

              const ageMs = Date.now() - updatedAtMs;
              const twelveHoursMs = 12 * 60 * 60 * 1000;

              if (ageMs < twelveHoursMs) {
                useCache = true;
                cachedData = cacheDocData.services;
              }
            }
          }
        } catch (cacheErr) {
          console.warn(
            "Failed to fetch services list from cache, falling back to API:",
            cacheErr,
          );
        }

        if (useCache) {
          // Filter for Instagram services only (case-insensitive with Unicode normalization and word boundary boundaries)
          const igData = cachedData.filter((s: SMMService) => {
            if (!s.category) return false;
            let normalized = s.category.normalize("NFKD").toLowerCase();
            normalized = normalized.replace(/i̇/g, "i").replace(/ı/g, "i");
            if (normalized.includes("instagram")) return true;
            const igRegex = /\big\b/i;
            return igRegex.test(normalized);
          });
          setServices(igData);
          const cats = Array.from(
            new Set(
              igData.map((s: SMMService) => s.category || "Uncategorized"),
            ),
          ) as string[];
          setCategories(cats.sort());
          if (cats.length > 0) {
            setSelectedCategory(cats[0]);
          }
          setLoadingServices(false);
          return;
        }

        // Fallback to SMM API
        const res = await fetch("/api/smm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "services", key: apiKey }),
        });
        const data = await res.json();

        if (Array.isArray(data)) {
          // Filter for Instagram services only (case-insensitive with Unicode normalization and word boundary boundaries)
          const igData = data.filter((s: SMMService) => {
            if (!s.category) return false;
            let normalized = s.category.normalize("NFKD").toLowerCase();
            normalized = normalized.replace(/i̇/g, "i").replace(/ı/g, "i");
            if (normalized.includes("instagram")) return true;
            const igRegex = /\big\b/i;
            return igRegex.test(normalized);
          });
          setServices(igData);
          // Extract unique categories
          const cats = Array.from(
            new Set(
              igData.map((s: SMMService) => s.category || "Uncategorized"),
            ),
          ) as string[];
          setCategories(cats.sort());
          if (cats.length > 0) {
            setSelectedCategory(cats[0]);
          }

          // Save to Firestore Cache asynchronously without blocking UI update
          try {
            await setDoc(
              cacheDocRef,
              {
                services: data,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch (writeErr) {
            console.error(
              "Failed to write services list to Firestore cache:",
              writeErr,
            );
          }
        } else {
          setFetchError(
            data?.error || "Failed to load services list from SMM API.",
          );
        }
      } catch (err) {
        console.error("Error loading SMM services:", err);
        setFetchError("API Network connection failed.");
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [apiKey]);

  if (!apiKey) {
    return (
      <div className="space-y-6 max-w-3xl font-sans">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
            Campaign Creator
          </h1>
          <p className="text-sm text-slate-450 mt-1">
            Configure and execute SMM orders for multiple services
            simultaneously
          </p>
        </div>
        <div className="bg-cyber-card border border-cyber-red/20 rounded-xl p-8 text-center space-y-4 shadow-lg">
          <AlertCircle className="w-12 h-12 text-cyber-red mx-auto animate-pulse" />
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            API Key Required
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            You must configure a valid SMM API key in your settings before you
            can create and launch campaigns.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-cyber-red hover:bg-cyber-red/90 text-white font-bold text-xs py-3 px-6 rounded-lg tracking-wider transition-all"
          >
            Configure API Key
          </Link>
        </div>
      </div>
    );
  }

  // Filter services by Category and Search query
  const filteredServices = services.filter((s) => {
    const matchesCat = selectedCategory
      ? s.category === selectedCategory
      : true;
    const matchesSearch = searchQuery
      ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.service.toString().includes(searchQuery)
      : true;
    return matchesCat && matchesSearch;
  });

  const addToCampaign = (service: SMMService) => {
    const newItem: CampaignItem = {
      id: `${service.service}-${++idCounter}`,
      service,
      quantity: Number(service.min) || 100,
      comments: "",
      usernames: "",
      username: "",
      answer_number: "1",
      dripEnabled: false,
      runs: 10,
      interval: 60,
    };
    setCampaignItems((prev) => [...prev, newItem]);
    addLog(`Added: ${service.name} (#${service.service})`);
  };

  const removeFromCampaign = (id: string) => {
    const item = campaignItems.find((i) => i.id === id);
    if (item) {
      addLog(`Removed: ${item.service.name}`);
    }
    setCampaignItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemField = (
    id: string,
    field: keyof CampaignItem,
    value: string | number | boolean,
  ) => {
    setCampaignItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleQtyChange = (id: string, valueStr: string, maxStr: string) => {
    if (valueStr === "") {
      updateItemField(id, "quantity", "");
      return;
    }
    const val = Number(valueStr);
    const maxVal = Number(maxStr) || Infinity;
    if (val > maxVal) {
      updateItemField(id, "quantity", maxVal);
    } else {
      updateItemField(id, "quantity", val);
    }
  };

  const handleQtyBlur = (id: string, value: number | string, minStr: string, maxStr: string) => {
    const minVal = Number(minStr) || 10;
    const maxVal = Number(maxStr) || Infinity;
    let val = Number(value);
    if (isNaN(val) || val < minVal) {
      val = minVal;
    } else if (val > maxVal) {
      val = maxVal;
    }
    updateItemField(id, "quantity", val);
  };

  // Place SMM Campaign orders
  const handleExecuteCampaign = async () => {
    if (!targetLink.trim()) {
      addLog("Error: Target link cannot be empty.");
      alert("Please provide a target link URL.");
      return;
    }
    if (campaignItems.length === 0) {
      addLog("Error: Basket is empty.");
      alert("Please add at least one service to your campaign.");
      return;
    }

    setExecuting(true);
    const batchId = Math.random().toString(36).substring(2, 11).toUpperCase();

    addLog(`Starting batch ${batchId}...`);
    addLog(`Target: ${targetLink}`);

    let successCount = 0;
    let failedCount = 0;

    for (let idx = 0; idx < campaignItems.length; idx++) {
      const item = campaignItems[idx];
      const s = item.service;
      const stepNum = idx + 1;

      addLog(`[${stepNum}/${campaignItems.length}] Processing ${s.name}...`);

      // Prepare SMM payload based on service type
      const payload: Record<string, string | number | boolean> = {
        action: "add",
        key: apiKey,
        service: s.service,
        link: targetLink.trim(),
      };

      const typeLower = s.type.toLowerCase();

      if (typeLower.includes("comments")) {
        payload.comments = item.comments || "";
      } else if (typeLower.includes("mentions")) {
        payload.quantity = clampQty(item.quantity, s.min, s.max);
        payload.usernames = item.usernames || "";
      } else if (typeLower.includes("comment likes")) {
        payload.quantity = clampQty(item.quantity, s.min, s.max);
        payload.username = item.username || "";
      } else if (typeLower.includes("poll")) {
        payload.quantity = clampQty(item.quantity, s.min, s.max);
        payload.answer_number = item.answer_number || "1";
      } else if (typeLower.includes("package")) {
      } else {
        payload.quantity = clampQty(item.quantity, s.min, s.max);
        if (item.dripEnabled) {
          payload.runs = Number(item.runs) || 10;
          payload.interval = Number(item.interval) || 60;
        }
      }

      try {
        const response = await fetch("/api/smm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (data && data.order) {
          addLog(`Success: Created order #${data.order}`);
          successCount++;

          if (user) {
            const orderQty = getItemQty(item);
            const orderCostINR = getItemCostINR(item);
            await addDoc(collection(db, "orders"), {
              userId: user.uid,
              serviceId: s.service,
              serviceName: s.name,
              serviceCategory: s.category,
              serviceType: s.type,
              link: targetLink.trim(),
              quantity: orderQty,
              smmOrderId: data.order,
              batchId,
              status: "Pending",
              charge: orderCostINR.toFixed(2),
              currency: "INR",
              remains: orderQty,
              createdAt: serverTimestamp(),
            });
          }
        } else {
          const errText = data?.error || "Unknown error.";
          addLog(`Failed: ${errText}`);
          failedCount++;
        }
      } catch {
        addLog(`Error: Connection failed.`);
        failedCount++;
      }
    }

    addLog(
      `Summary: Finished. Success: ${successCount}, Failed: ${failedCount}`,
    );
    setExecuting(false);

    if (successCount > 0) {
      setCampaignItems([]);
      alert(`Campaign Complete! Placed ${successCount} orders successfully.`);
    } else {
      alert("Campaign Execution failed. Check the terminal logs on the right.");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
          Place Campaign Orders
        </h1>
        <p className="text-sm text-slate-450 mt-1">
          Configure SMM orders for multiple services and execute them
          simultaneously.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Campaign builder & services selection (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Target link Input */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-green"></div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Target Link URL
            </label>
            <input
              type="url"
              placeholder="https://www.instagram.com/p/C..."
              className="w-full bg-cyber-input/60 border border-cyber-border rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-green transition-all"
              value={targetLink}
              onChange={(e) => setTargetLink(e.target.value)}
              disabled={executing}
            />
          </div>

          {/* Campaign Items Deck */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg relative min-h-[200px]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-purple"></div>
            <div className="flex justify-between items-center border-b border-cyber-border pb-3.5 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyber-purple" />
                Order Basket ({campaignItems.length})
              </h2>
              {campaignItems.length > 0 && (
                <button
                  onClick={() => setCampaignItems([])}
                  className="text-xs text-cyber-red hover:text-cyber-red/80 hover:underline uppercase font-bold transition-all"
                  disabled={executing}
                >
                  Clear All
                </button>
              )}
            </div>

            {campaignItems.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-550 mx-auto animate-pulse" />
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Your basket is empty
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Select a category in the catalog below, find services, and
                  click &quot;+&quot; to add them to your campaign basket.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaignItems.map((item) => {
                  const s = item.service;
                  const typeLower = s.type.toLowerCase();

                  return (
                    <div
                      key={item.id}
                      className="bg-cyber-input/40 border border-cyber-border rounded-lg p-4.5 relative flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all"
                    >
                      {/* Left info */}
                      <div className="space-y-1.5 max-w-sm">
                        <div className="text-[10px] text-cyber-purple font-semibold uppercase tracking-wider">
                          Service #{s.service} — {s.category}
                        </div>
                        <h3 className="text-sm font-bold text-white leading-snug">
                          {s.name}
                        </h3>
                        <div className="text-xs text-slate-455">
                          Type:{" "}
                          <span className="text-cyber-blue font-semibold">
                            {s.type}
                          </span>{" "}
                          | Rate:{" "}
                          <span className="text-cyber-green font-semibold">
                            ₹{s.rate}/1k
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Est. cost:{" "}
                          <span className="text-cyber-yellow font-semibold">
                            ₹{getItemCostINR(item).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Dynamic Inputs based on type */}
                      <div className="flex-1 max-w-xs">
                        {/* Custom Comments Form */}
                        {typeLower.includes("comments") && (
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-semibold block">
                              Comments (one comment per line)
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Great!&#10;Nice photo!&#10;Incredible!"
                              className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyber-purple transition-all"
                              value={item.comments || ""}
                              onChange={(e) =>
                                updateItemField(
                                  item.id,
                                  "comments",
                                  e.target.value,
                                )
                              }
                              disabled={executing}
                            />
                          </div>
                        )}

                        {/* Mentions Form */}
                        {typeLower.includes("mentions") && (
                          <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 font-semibold block">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                  value={item.quantity ?? ""}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      item.id,
                                      e.target.value,
                                      s.max,
                                    )
                                  }
                                  onBlur={(e) =>
                                    handleQtyBlur(
                                      item.id,
                                      e.target.value,
                                      s.min,
                                      s.max,
                                    )
                                  }
                                  disabled={executing}
                                />
                              </div>
                              <div className="flex items-end">
                                <span className="text-[10px] text-slate-500 font-semibold font-mono">
                                  Min: {s.min} | Max: {s.max}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 font-semibold block">
                                Usernames (one username per line)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="user1&#10;user2"
                                className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyber-purple transition-all"
                                value={item.usernames || ""}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    "usernames",
                                    e.target.value,
                                  )
                                }
                                disabled={executing}
                              />
                            </div>
                          </div>
                        )}

                        {/* Comment Likes Form */}
                        {typeLower.includes("comment likes") && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 font-semibold block">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                  value={item.quantity ?? ""}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      item.id,
                                      e.target.value,
                                      s.max,
                                    )
                                  }
                                  onBlur={(e) =>
                                    handleQtyBlur(
                                      item.id,
                                      e.target.value,
                                      s.min,
                                      s.max,
                                    )
                                  }
                                  disabled={executing}
                                />
                              </div>
                              <div className="flex items-end">
                                <span className="text-[10px] text-slate-500 font-semibold font-mono">
                                  Min: {s.min}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 font-semibold block">
                                Comment Username
                              </label>
                              <input
                                type="text"
                                placeholder="username"
                                className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                value={item.username || ""}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    "username",
                                    e.target.value,
                                  )
                                }
                                disabled={executing}
                              />
                            </div>
                          </div>
                        )}

                        {/* Poll Form */}
                        {typeLower.includes("poll") && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 font-semibold block">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                  value={item.quantity ?? ""}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      item.id,
                                      e.target.value,
                                      s.max,
                                    )
                                  }
                                  onBlur={(e) =>
                                    handleQtyBlur(
                                      item.id,
                                      e.target.value,
                                      s.min,
                                      s.max,
                                    )
                                  }
                                  disabled={executing}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 font-semibold block">
                                  Answer (Option #)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 1"
                                  className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                  value={item.answer_number || "1"}
                                  onChange={(e) =>
                                    updateItemField(
                                      item.id,
                                      "answer_number",
                                      e.target.value,
                                    )
                                  }
                                  disabled={executing}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Package Type (No inputs) */}
                        {typeLower.includes("package") && (
                          <div className="text-xs text-slate-500 italic">
                            No additional parameters needed for this service
                            package.
                          </div>
                        )}

                        {/* Default SMM Type */}
                        {!typeLower.includes("comments") &&
                          !typeLower.includes("mentions") &&
                          !typeLower.includes("comment likes") &&
                          !typeLower.includes("poll") &&
                          !typeLower.includes("package") && (
                            <div className="space-y-3.5 font-sans">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-slate-400 font-semibold block">
                                    Quantity
                                  </label>
                                  <input
                                    type="number"
                                    min={s.min}
                                    max={s.max}
                                    className="w-full bg-cyber-card border border-cyber-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all"
                                    value={item.quantity ?? ""}
                                    onChange={(e) =>
                                      handleQtyChange(
                                        item.id,
                                        e.target.value,
                                        s.max,
                                      )
                                    }
                                    onBlur={(e) =>
                                      handleQtyBlur(
                                        item.id,
                                        e.target.value,
                                        s.min,
                                        s.max,
                                      )
                                    }
                                    disabled={executing}
                                  />
                                </div>
                                <div className="flex items-end text-[10px] text-slate-550 leading-normal font-semibold font-mono">
                                  Min: {s.min} <br /> Max: {s.max}
                                </div>
                              </div>

                              {/* Drip-Feed Option */}
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-400 font-semibold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-cyber-purple w-4 h-4 rounded"
                                    checked={item.dripEnabled || false}
                                    onChange={(e) =>
                                      updateItemField(
                                        item.id,
                                        "dripEnabled",
                                        e.target.checked,
                                      )
                                    }
                                    disabled={executing}
                                  />
                                  Enable Drip-Feed
                                </label>

                                {item.dripEnabled && (
                                  <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-cyber-card rounded-lg border border-cyber-border transition-all">
                                    <div>
                                      <label className="text-[10px] text-slate-500 uppercase block font-bold">
                                        Runs
                                      </label>
                                      <input
                                        type="number"
                                        className="w-full bg-cyber-input border border-cyber-border rounded-lg p-1.5 text-xs text-white focus:outline-none"
                                        value={item.runs || 10}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "runs",
                                            Number(e.target.value),
                                          )
                                        }
                                        disabled={executing}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-slate-500 uppercase block font-bold">
                                        Interval (min)
                                      </label>
                                      <input
                                        type="number"
                                        className="w-full bg-cyber-input border border-cyber-border rounded-lg p-1.5 text-xs text-white focus:outline-none"
                                        value={item.interval || 60}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "interval",
                                            Number(e.target.value),
                                          )
                                        }
                                        disabled={executing}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Right: Delete button */}
                      <div>
                        <button
                          onClick={() => removeFromCampaign(item.id)}
                          className="p-2 text-slate-400 hover:text-cyber-red border border-transparent hover:border-cyber-red/20 hover:bg-cyber-red/5 rounded-lg transition-all cursor-pointer"
                          disabled={executing}
                          title="Remove service"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Big Execute Campaign Button */}
                <button
                  onClick={handleExecuteCampaign}
                  disabled={executing}
                  className="w-full bg-cyber-purple hover:bg-cyber-blue text-black font-extrabold text-sm py-4 px-4 rounded-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-5 hover:shadow-[0_0_20px_rgba(247,151,29,0.35)]"
                >
                  {executing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      Submitting campaign orders...
                    </>
                  ) : (
                    <>
                      Submit Campaign Orders — ₹{totalINRCost.toFixed(2)} (
                      {campaignItems.length} services)
                      <Play className="w-4 h-4 fill-black text-black" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* SMM Services Selector Explorer */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyber-blue"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyber-border pb-4 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Service Catalog
              </h2>
              {/* Category selector & search bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  className="bg-cyber-input border border-cyber-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyber-blue transition-all"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={loadingServices}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c.substring(0, 35)}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    className="bg-cyber-input border border-cyber-border rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyber-blue w-44 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loadingServices}
                  />
                </div>
              </div>
            </div>

            {loadingServices ? (
              <div className="text-center py-12 text-sm text-slate-450 animate-pulse">
                Loading SMM service catalog...
              </div>
            ) : fetchError ? (
              <div className="p-4 bg-cyber-red/10 border border-cyber-red/20 rounded-lg text-cyber-red text-xs text-center">
                [Error Loading Catalog]: {fetchError}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No matching services found.
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border border-cyber-border rounded-lg bg-cyber-bg/40 divide-y divide-cyber-border">
                {filteredServices.map((s) => (
                  <div
                    key={s.service}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-800/10 transition-colors"
                  >
                    <div className="space-y-1 pr-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyber-blue font-semibold font-mono">
                          #{s.service}
                        </span>
                        <span className="text-[9px] bg-cyber-border text-slate-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                          {s.type}
                        </span>
                      </div>
                      <h4 className="text-xs text-white font-bold leading-normal">
                        {s.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Rate:{" "}
                        <span className="text-cyber-green font-semibold">
                          ₹{s.rate}/1k
                        </span>{" "}
                        | Min: {s.min} | Max: {s.max}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCampaign(s)}
                      className="bg-cyber-blue/10 hover:bg-cyber-blue hover:text-white border border-cyber-blue/30 hover:border-transparent px-3 py-1.5 rounded-lg text-xs text-cyber-blue font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                      disabled={executing}
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active campaign Console Logger (4 cols) */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-border rounded-xl p-6 flex flex-col justify-between shadow-2xl h-[400px] lg:h-[600px] sticky top-6">
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4.5 h-4.5 text-cyber-green animate-pulse" />
                  <span className="text-xs font-semibold text-slate-350 tracking-wider uppercase">
                    Campaign Execution Status
                  </span>
                </div>
                {consoleLogs.length > 1 && (
                  <button
                    onClick={() => setConsoleLogs(["Logs cleared. Ready."])}
                    className="text-xs text-slate-500 hover:text-slate-355 uppercase font-semibold transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2 text-xs leading-relaxed overflow-y-auto max-h-[280px] lg:max-h-[460px] pr-1 text-slate-400">
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className="terminal-line text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-cyber-border pt-4 mt-4 text-xs text-slate-550 shrink-0 space-y-1 font-semibold">
              <p>
                Status:{" "}
                <span className="text-cyber-purple uppercase">Ready</span>
              </p>
              <p>
                Selected:{" "}
                <span className="text-cyber-green">
                  {campaignItems.length} services in basket
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
