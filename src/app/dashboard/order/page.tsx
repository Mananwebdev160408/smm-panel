"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Layers, 
  Plus, 
  Trash2, 
  Play, 
  Search, 
  Terminal, 
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles
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
    "CAMPAIGN ENGINE IDLE. STANDBY FOR LINK INPUT...",
  ]);

  const addLog = (log: string) => {
    setConsoleLogs((prev) => [...prev, log]);
  };

  // Fetch services list
  useEffect(() => {
    const fetchServices = async () => {
      if (!apiKey) return;
      setLoadingServices(true);
      setFetchError("");
      try {
        const res = await fetch("/api/smm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "services", key: apiKey }),
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setServices(data);
          // Extract unique categories
          const cats = Array.from(new Set(data.map((s: any) => s.category || "Uncategorized"))) as string[];
          setCategories(cats.sort());
          if (cats.length > 0) {
            setSelectedCategory(cats[0]);
          }
        } else {
          setFetchError(data?.error || "Failed to load services list from SMM API.");
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
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
            MULTI-ORDER CAMPAIGN DECK
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
            Execute parallel actions on multiple services simultaneously
          </p>
        </div>
        <div className="bg-cyber-card border border-cyber-red/20 rounded-lg p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-cyber-red mx-auto animate-pulse" />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            [ACCESS REJECTED: API GATEWAY OFFLINE]
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            You must configure a valid BuzzPlusSMM API key in your node settings before you can compile and deploy multi-order campaigns.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-cyber-red hover:bg-cyber-red hover:shadow-[0_0_15px_rgba(255,51,102,0.25)] text-black font-extrabold text-xs py-2 px-6 rounded tracking-wider transition-all"
          >
            CONFIGURE API NODE
          </Link>
        </div>
      </div>
    );
  }

  // Filter services by Category and Search query
  const filteredServices = services.filter((s) => {
    const matchesCat = selectedCategory ? s.category === selectedCategory : true;
    const matchesSearch = searchQuery
      ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.service.toString().includes(searchQuery)
      : true;
    return matchesCat && matchesSearch;
  });

  const addToCampaign = (service: SMMService) => {
    const newItem: CampaignItem = {
      id: Math.random().toString(36).substring(2, 9),
      service,
      quantity: Number(service.min) || 100,
      comments: "",
      usernames: "",
      username: "",
      answer_number: "1",
      dripEnabled: false,
      runs: 10,
      interval: 60
    };
    setCampaignItems((prev) => [...prev, newItem]);
    addLog(`[ADDED TO DECK] ID ${service.service}: ${service.name} (Type: ${service.type})`);
  };

  const removeFromCampaign = (id: string) => {
    const item = campaignItems.find(i => i.id === id);
    if (item) {
      addLog(`[REMOVED FROM DECK] ID ${item.service.service}: ${item.service.name}`);
    }
    setCampaignItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemField = (id: string, field: keyof CampaignItem, value: any) => {
    setCampaignItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Place SMM Campaign orders
  const handleExecuteCampaign = async () => {
    if (!targetLink.trim()) {
      addLog("[ALERT] CAMPAIGN EXECUTION HALTED: TARGET LINK CANNOT BE EMPTY.");
      alert("Please provide a target link URL.");
      return;
    }
    if (campaignItems.length === 0) {
      addLog("[ALERT] CAMPAIGN EXECUTION HALTED: DECK HAS ZERO SELECTED SERVICES.");
      alert("Please add at least one service to your campaign.");
      return;
    }

    setExecuting(true);
    const batchId = Math.random().toString(36).substring(2, 11).toUpperCase();
    
    addLog(`[START BATCH ${batchId}] COMPILING DECK CONFIGS...`);
    addLog(`[TARGET URL] ${targetLink}`);

    let successCount = 0;
    let failedCount = 0;

    for (let idx = 0; idx < campaignItems.length; idx++) {
      const item = campaignItems[idx];
      const s = item.service;
      const stepNum = idx + 1;
      
      addLog(`[STEP ${stepNum}/${campaignItems.length}] DEPLOYING ORDER: Service ${s.service} (${s.name})...`);

      // Prepare SMM payload based on service type
      const payload: any = {
        action: "add",
        key: apiKey,
        service: s.service,
        link: targetLink.trim(),
      };

      const typeLower = s.type.toLowerCase();

      if (typeLower.includes("comments")) {
        // Custom comments
        payload.comments = item.comments || "";
      } else if (typeLower.includes("mentions")) {
        // Mentions
        payload.quantity = Number(item.quantity) || 100;
        payload.usernames = item.usernames || "";
      } else if (typeLower.includes("comment likes")) {
        // Comment Likes
        payload.quantity = Number(item.quantity) || 100;
        payload.username = item.username || "";
      } else if (typeLower.includes("poll")) {
        // Poll
        payload.quantity = Number(item.quantity) || 100;
        payload.answer_number = item.answer_number || "1";
      } else if (typeLower.includes("package")) {
        // Package has no quantity or extra inputs
      } else {
        // Default
        payload.quantity = Number(item.quantity) || 100;
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
          addLog(`[STEP ${stepNum} SUCCESS] BuzzPlusSMM ORDER CREATED: ID ${data.order}`);
          successCount++;

          // Write to user history DB (Firestore)
          if (user) {
            await addDoc(collection(db, "orders"), {
              userId: user.uid,
              serviceId: s.service,
              serviceName: s.name,
              serviceCategory: s.category,
              serviceType: s.type,
              link: targetLink.trim(),
              quantity: payload.quantity || 1,
              smmOrderId: data.order,
              batchId,
              status: "Pending", // initial status
              charge: "0.00", // fetched via status sync
              remains: payload.quantity || 0,
              createdAt: serverTimestamp(),
            });
          }
        } else {
          const errText = data?.error || "Unknown SMM error code.";
          addLog(`[STEP ${stepNum} FAILED] REJECTED BY SMM: ${errText}`);
          failedCount++;
        }
      } catch (err: any) {
        console.error("Step execution error:", err);
        addLog(`[STEP ${stepNum} FATAL] BRIDGE CONNECTION ERROR.`);
        failedCount++;
      }
    }

    addLog(`[BATCH ${batchId} SUMMARY] COMPLETE. Success: ${successCount}, Failures: ${failedCount}.`);
    setExecuting(false);
    
    if (successCount > 0) {
      setCampaignItems([]);
      alert(`Campaign Complete! Placed ${successCount} orders successfully.`);
    } else {
      alert("Campaign Execution failed. Check the terminal logs on the right.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
          MULTI-ORDER CAMPAIGN DECK
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
          Build actions basket and execute parallel orders in one single click
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Campaign builder & services selection (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Target link Input */}
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-green"></div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              TARGET URL LINK
            </label>
            <input
              type="url"
              placeholder="https://www.instagram.com/p/C..."
              className="w-full bg-cyber-input border border-cyber-border rounded px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-green transition-all"
              value={targetLink}
              onChange={(e) => setTargetLink(e.target.value)}
              disabled={executing}
            />
          </div>

          {/* Campaign Items Deck */}
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 shadow-lg relative min-h-[200px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-purple"></div>
            <div className="flex justify-between items-center border-b border-cyber-border pb-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyber-purple" />
                Selected Services Basket ({campaignItems.length})
              </h2>
              {campaignItems.length > 0 && (
                <button
                  onClick={() => setCampaignItems([])}
                  className="text-[10px] text-cyber-red hover:underline uppercase font-bold"
                  disabled={executing}
                >
                  Clear All
                </button>
              )}
            </div>

            {campaignItems.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <HelpCircle className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 uppercase tracking-widest">Deck Basket is Empty</p>
                <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                  Select a category below, find services, and click "+" to add actions to this deck.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaignItems.map((item, idx) => {
                  const s = item.service;
                  const typeLower = s.type.toLowerCase();
                  
                  return (
                    <div 
                      key={item.id} 
                      className="bg-cyber-input border border-cyber-border rounded p-4 relative flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left info */}
                      <div className="space-y-1 max-w-sm">
                        <div className="text-[10px] text-cyber-purple font-bold">
                          [ID: {s.service}] - {s.category}
                        </div>
                        <h3 className="text-xs font-extrabold text-white leading-snug">
                          {s.name}
                        </h3>
                        <div className="text-[9px] text-slate-500 uppercase">
                          Type: <span className="text-cyber-blue font-bold">{s.type}</span> | 
                          Rate: <span className="text-cyber-green font-bold">${s.rate}/1k</span>
                        </div>
                      </div>

                      {/* Middle: Dynamic Inputs based on type */}
                      <div className="flex-1 max-w-xs">
                        
                        {/* Custom Comments Form */}
                        {typeLower.includes("comments") && (
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-400 font-bold block uppercase">
                              Comments (one per line)
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Nice pic!&#10;Wow!&#10;Incredible!"
                              className="w-full bg-cyber-card border border-cyber-border rounded p-2 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyber-purple"
                              value={item.comments || ""}
                              onChange={(e) => updateItemField(item.id, "comments", e.target.value)}
                              disabled={executing}
                            />
                          </div>
                        )}

                        {/* Mentions Form */}
                        {typeLower.includes("mentions") && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-slate-400 font-bold block uppercase">Quantity</label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                  value={item.quantity || 100}
                                  onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                                  disabled={executing}
                                />
                              </div>
                              <div className="flex items-end">
                                <span className="text-[8px] text-slate-500">Min: {s.min} | Max: {s.max}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-400 font-bold block uppercase">Usernames (one per line)</label>
                              <textarea
                                rows={2}
                                placeholder="username1&#10;username2"
                                className="w-full bg-cyber-card border border-cyber-border rounded p-2 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyber-purple"
                                value={item.usernames || ""}
                                onChange={(e) => updateItemField(item.id, "usernames", e.target.value)}
                                disabled={executing}
                              />
                            </div>
                          </div>
                        )}

                        {/* Comment Likes Form */}
                        {typeLower.includes("comment likes") && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-slate-400 font-bold block uppercase">Quantity</label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                  value={item.quantity || 100}
                                  onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                                  disabled={executing}
                                />
                              </div>
                              <div className="flex items-end">
                                <span className="text-[8px] text-slate-500">Min: {s.min}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-400 font-bold block uppercase">Comment Owner Username</label>
                              <input
                                type="text"
                                placeholder="john_doe"
                                className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                value={item.username || ""}
                                onChange={(e) => updateItemField(item.id, "username", e.target.value)}
                                disabled={executing}
                              />
                            </div>
                          </div>
                        )}

                        {/* Poll Form */}
                        {typeLower.includes("poll") && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-slate-400 font-bold block uppercase">Quantity</label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                  value={item.quantity || 100}
                                  onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                                  disabled={executing}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-400 font-bold block uppercase">Answer (Option #)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 1"
                                  className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                  value={item.answer_number || "1"}
                                  onChange={(e) => updateItemField(item.id, "answer_number", e.target.value)}
                                  disabled={executing}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Package Type (No inputs) */}
                        {typeLower.includes("package") && (
                          <div className="text-[10px] text-slate-500 italic">
                            No parameters needed. (Pre-packaged service quantity).
                          </div>
                        )}

                        {/* Default SMM Type */}
                        {!typeLower.includes("comments") && 
                         !typeLower.includes("mentions") && 
                         !typeLower.includes("comment likes") && 
                         !typeLower.includes("poll") && 
                         !typeLower.includes("package") && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-slate-400 font-bold block uppercase">Quantity</label>
                                <input
                                  type="number"
                                  min={s.min}
                                  max={s.max}
                                  className="w-full bg-cyber-card border border-cyber-border rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyber-purple"
                                  value={item.quantity || 100}
                                  onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                                  disabled={executing}
                                />
                              </div>
                              <div className="flex items-end text-[8px] text-slate-500 leading-normal">
                                Min: {s.min}<br/>Max: {s.max}
                              </div>
                            </div>
                            
                            {/* Drip-Feed Option */}
                            <div className="space-y-1">
                              <label className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="accent-cyber-purple"
                                  checked={item.dripEnabled || false}
                                  onChange={(e) => updateItemField(item.id, "dripEnabled", e.target.checked)}
                                  disabled={executing}
                                />
                                Enable Drip-Feed
                              </label>
                              
                              {item.dripEnabled && (
                                <div className="grid grid-cols-2 gap-2 p-1.5 bg-cyber-card rounded border border-cyber-border">
                                  <div>
                                    <label className="text-[8px] text-slate-500 block uppercase">Runs</label>
                                    <input
                                      type="number"
                                      className="w-full bg-cyber-input border border-cyber-border rounded p-1 text-[10px] text-white font-mono focus:outline-none"
                                      value={item.runs || 10}
                                      onChange={(e) => updateItemField(item.id, "runs", Number(e.target.value))}
                                      disabled={executing}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-500 block uppercase">Interval (min)</label>
                                    <input
                                      type="number"
                                      className="w-full bg-cyber-input border border-cyber-border rounded p-1 text-[10px] text-white font-mono focus:outline-none"
                                      value={item.interval || 60}
                                      onChange={(e) => updateItemField(item.id, "interval", Number(e.target.value))}
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
                          className="p-2 text-slate-500 hover:text-cyber-red border border-transparent hover:border-cyber-red/20 hover:bg-cyber-red/5 rounded transition-all cursor-pointer"
                          disabled={executing}
                          title="Remove service"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Big Execute Campaign Button */}
                <button
                  onClick={handleExecuteCampaign}
                  disabled={executing}
                  className="w-full bg-gradient-to-r from-cyber-green to-cyber-green-dim hover:from-cyber-green hover:to-cyber-green hover:shadow-[0_0_20px_rgba(0,255,102,0.3)] text-black font-extrabold text-xs py-3.5 px-4 rounded tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-4"
                >
                  {executing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      EXECUTING PARALLEL CAMPAIGN...
                    </>
                  ) : (
                    <>
                      DEPLOY CAMPAIGN PACKET ({campaignItems.length} ACTIONS)
                      <Play className="w-3.5 h-3.5 fill-black" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* SMM Services Selector Explorer */}
          <div className="bg-cyber-card border border-cyber-border rounded-lg p-5 shadow-lg relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyber-blue"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyber-border pb-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Services Database Explorer
              </h2>
              {/* Category selector & search bar */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="bg-cyber-input border border-cyber-border rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-cyber-blue"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={loadingServices}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c.substring(0, 30)}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search service/ID..."
                    className="bg-cyber-input border border-cyber-border rounded pl-8 pr-2.5 py-1.5 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-cyber-blue w-40"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loadingServices}
                  />
                </div>
              </div>
            </div>

            {loadingServices ? (
              <div className="text-center py-10 font-mono text-xs text-slate-500 animate-pulse">
                PARSING SMM SERVICES CATALOG...
              </div>
            ) : fetchError ? (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded text-cyber-red text-xs text-center font-mono">
                [CATALOG FAULT]: {fetchError}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                NO MATCHING SERVICES FOUND.
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border border-cyber-border rounded bg-cyber-bg/40 divide-y divide-cyber-border">
                {filteredServices.map((s) => (
                  <div 
                    key={s.service} 
                    className="p-3 flex items-center justify-between hover:bg-cyber-input/30 transition-colors"
                  >
                    <div className="space-y-0.5 pr-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-cyber-blue font-bold">#{s.service}</span>
                        <span className="text-[10px] bg-cyber-border text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold text-[8px] uppercase">
                          {s.type}
                        </span>
                      </div>
                      <h4 className="text-xs text-white font-bold leading-normal">{s.name}</h4>
                      <p className="text-[9px] text-slate-500">
                        Rate: <span className="text-cyber-green">${s.rate}/1k</span> | Min: {s.min} | Max: {s.max}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCampaign(s)}
                      className="bg-cyber-blue/10 hover:bg-cyber-blue hover:text-black border border-cyber-blue/30 hover:border-transparent px-2.5 py-1 rounded text-[10px] text-cyber-blue font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                      disabled={executing}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      ADD
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Active campaign Console Logger (4 cols) */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-border rounded-lg p-5 font-mono flex flex-col justify-between shadow-2xl h-[400px] lg:h-[600px] sticky top-6">
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-cyber-border pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyber-green animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider">CAMPAIGN-LOGS.SH</span>
                </div>
                {consoleLogs.length > 1 && (
                  <button 
                    onClick={() => setConsoleLogs(["CONSOLE CLEARED. ENGINE STANDBY..."])}
                    className="text-[8px] text-slate-500 hover:text-slate-300 uppercase font-bold"
                  >
                    Clear Logs
                  </button>
                )}
              </div>
              <div className="space-y-2 text-[10px] leading-relaxed overflow-y-auto max-h-[280px] lg:max-h-[460px] pr-1 scrollbar-thin">
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className="terminal-line text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t border-cyber-border pt-3 mt-3 text-[9px] text-slate-500 shrink-0">
              <p>CAMPAIGN BATCH: <span className="text-cyber-purple font-bold">READY</span></p>
              <p>BUFFER STACK: <span className="text-cyber-green font-bold">{campaignItems.length} SERVICES QUEUED</span></p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
