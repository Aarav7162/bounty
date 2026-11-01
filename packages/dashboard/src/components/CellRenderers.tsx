import React, { useState } from "react";
import type { ICellRendererParams } from "ag-grid-community";
import { Copy, Check, Clock, Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react";

export const StatusCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const status = (params.value || "").toUpperCase();

  switch (status) {
    case "SETTLED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <CreditCard className="w-3 h-3" />
          SETTLED
        </span>
      );
    case "VERIFIED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
          <CheckCircle2 className="w-3 h-3" />
          VERIFIED
        </span>
      );
    case "EXECUTING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          EXECUTING
        </span>
      );
    case "CLAIMED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30">
          <Clock className="w-3 h-3" />
          CLAIMED
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3 h-3" />
          FAILED
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{params.value || "—"}</span>;
  }
};

export const BatchIdCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const [copied, setCopied] = useState(false);
  const rawId = params.value || "";

  if (!rawId || rawId === "—") {
    return <span className="text-slate-500 text-xs">—</span>;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(rawId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="Click to copy full PayPal Batch ID"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-sky-400 font-mono text-xs border border-slate-700/60 transition-colors group cursor-pointer"
    >
      <span>{rawId.length > 14 ? `${rawId.slice(0, 14)}...` : rawId}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400 group-hover:text-sky-300 opacity-60 group-hover:opacity-100" />
      )}
    </button>
  );
};

export const RfpIdCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const [copied, setCopied] = useState(false);
  const rawId = params.value || "";

  if (!rawId) return <span className="text-slate-500 text-xs">—</span>;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(rawId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncated = rawId.length > 12 ? `${rawId.slice(0, 10)}...` : rawId;

  return (
    <button
      onClick={handleCopy}
      title={`Click to copy: ${rawId}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-mono text-xs border border-slate-800 hover:border-slate-700 transition-colors group cursor-pointer"
    >
      <span>{truncated}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
      )}
    </button>
  );
};

export const LatencyCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const ms = Number(params.value || 0);
  if (!ms) return <span className="text-slate-500 text-xs">—</span>;

  // Max scale 4000ms
  const pct = Math.min(100, Math.max(5, (ms / 4000) * 100));

  let barColor = "bg-emerald-500";
  if (ms > 2500) barColor = "bg-rose-500";
  else if (ms > 1500) barColor = "bg-amber-500";

  return (
    <div className="flex items-center gap-2 w-full h-full">
      <div className="w-16 bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-300 tabular-nums">
        {ms}ms
      </span>
    </div>
  );
};

