import React from "react";
import { DollarSign, Activity, Server, Zap } from "lucide-react";
import { KPIData } from "../types";

interface KPICardsProps {
  kpis: KPIData;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Settled Volume */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-yellow-300" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Settled (USD)</p>
            <h3 className="text-2xl font-bold text-yellow-400 mt-1 font-mono tracking-tight">
              ${kpis.totalSettledUsd.toFixed(2)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <span className="text-emerald-400 font-medium">PayPal Rails</span> · Instant micro-payouts
        </p>
      </div>

      {/* 2. Jobs Today */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 to-cyan-300" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Jobs Completed</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono tracking-tight">
              {kpis.jobsToday}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <span className="text-cyan-400 font-medium">100% Cryptographic</span> · Verified SHA-256
        </p>
      </div>

      {/* 3. Average Latency */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-300" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Average Latency</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1 font-mono tracking-tight">
              {kpis.avgLatencyMs} <span className="text-sm font-normal text-slate-400">ms</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <span className="text-emerald-400 font-medium">Low Overhead</span> · Subprocess isolation
        </p>
      </div>

      {/* 4. Active Worker Nodes */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-400" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Worker Nodes</p>
            <h3 className="text-2xl font-bold text-purple-300 mt-1 font-mono tracking-tight">
              {kpis.activeNodes}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Server className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-medium">Keepalive Active</span> · Real-time mesh
        </p>
      </div>
    </div>
  );
};

