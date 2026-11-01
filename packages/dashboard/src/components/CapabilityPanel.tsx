import React, { useState } from "react";
import { Sliders, CheckCircle2, ShieldCheck, Terminal, FileText, Globe, Network } from "lucide-react";

interface Capability {
  id: string;
  name: string;
  desc: string;
  floorPrice: string;
  enabled: boolean;
  icon: any;
}

export const CapabilityPanel: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([
    {
      id: "python_code",
      name: "python_code",
      desc: "Subprocess execution with AST syntax & unit test verification",
      floorPrice: "$0.25",
      enabled: true,
      icon: Terminal
    },
    {
      id: "ocr",
      name: "ocr",
      desc: "Tesseract v5.4.0 neural net OCR on image bytes",
      floorPrice: "$0.20",
      enabled: true,
      icon: FileText
    },
    {
      id: "web_scrape",
      name: "web_scrape",
      desc: "httpx client + BeautifulSoup HTML sanitization",
      floorPrice: "$0.05",
      enabled: true,
      icon: Globe
    },
    {
      id: "residential_scrape",
      name: "residential_scrape",
      desc: "Residential proxy routing with Cloudflare Turnstile clearance",
      floorPrice: "$0.05",
      enabled: true,
      icon: Network
    }
  ]);

  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const toggleCapability = async (id: string) => {
    const cap = capabilities.find((c) => c.id === id);
    if (!cap) return;
    const nextState = !cap.enabled;

    setCapabilities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: nextState } : c))
    );

    try {
      await fetch("http://localhost:4000/api/capabilities/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability: id, enabled: nextState })
      });
      setBroadcastStatus(`Broadcasted ${id} ${nextState ? "ENABLED" : "DISABLED"} to worker mesh`);
      setTimeout(() => setBroadcastStatus(null), 3000);
    } catch {
      // Local fallback
      setBroadcastStatus(`Updated ${id} locally`);
      setTimeout(() => setBroadcastStatus(null), 2500);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <h4 className="text-sm font-semibold text-white tracking-wide">
            Live Worker Capability Mesh & Floor Prices
          </h4>
          <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/40">
            Real-Time Broadcast
          </span>
        </div>
        {broadcastStatus && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 animate-fade-in font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {broadcastStatus}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.id}
              onClick={() => toggleCapability(cap.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between select-none ${
                cap.enabled
                  ? "bg-slate-800/60 border-slate-700/80 hover:border-sky-500/50"
                  : "bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${cap.enabled ? "text-sky-400" : "text-slate-500"}`} />
                    <span className="text-xs font-mono font-semibold text-slate-200">
                      {cap.name}
                    </span>
                  </div>
                  {/* Switch */}
                  <div
                    className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                      cap.enabled ? "bg-sky-500" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform ${
                        cap.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {cap.desc}
                </p>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                  Floor Floor
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {cap.floorPrice}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

