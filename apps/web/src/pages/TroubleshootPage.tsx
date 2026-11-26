import { useEffect, useState } from 'react';
import { CheckCircle2, Globe, RefreshCw, Server, ShieldAlert, Wifi, XCircle } from 'lucide-react';
import type { LanNetworkInfo } from '@ludo-arena/shared-types';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import {
  fetchCompanionHealth,
  fetchLanInfo,
  getServerBaseUrl,
  setServerBaseUrl,
} from '../services/socketClient';

export function TroubleshootPage() {
  const { socketConnected, companionReachable, refreshHealth } = useArena();
  const [lanInfo, setLanInfo] = useState<LanNetworkInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [serverInput, setServerInput] = useState(() => getServerBaseUrl());
  const [savedNotice, setSavedNotice] = useState(false);

  const runDiagnostics = async () => {
    setChecking(true);
    await refreshHealth();
    await fetchCompanionHealth();
    const lan = await fetchLanInfo();
    setLanInfo(lan);
    setChecking(false);
  };

  useEffect(() => {
    void runDiagnostics();
  }, []);

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-white">LAN & Connection Diagnostics</h1>
            <p className="text-slate-400 text-sm mt-1">
              Verify companion coordinator health, local IP addresses, and mobile QR joining.
            </p>
          </div>
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={checking}
            className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 hover:bg-indigo-400 transition"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Run Check
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 flex items-center gap-4">
            {companionReachable ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-bold text-white">Companion HTTP API</div>
              <div className="text-xs text-slate-400">
                {companionReachable
                  ? 'Reachable on /api/health'
                  : 'Not responding — run start-host.bat or npm start'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 flex items-center gap-4">
            {socketConnected ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-bold text-white">Real-Time Socket.IO</div>
              <div className="text-xs text-slate-400">
                {socketConnected
                  ? 'WebSocket / polling link active'
                  : 'Disconnected from game coordinator'}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h2>Coordinator Server URL (Vercel / Remote Host)</h2>
          </div>
          <p className="text-xs text-slate-400">
            Leave blank for automatic same-origin LAN hosting. If you deployed the UI on Vercel,
            set this to your Node coordinator URL (for example{' '}
            <code className="text-amber-300">http://localhost:3001</code> for local hosting or{' '}
            <code className="text-amber-300">https://your-server.onrender.com</code>).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="http://localhost:3001"
              className="flex-1 min-w-[220px] rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setServerBaseUrl(serverInput);
                setSavedNotice(true);
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition"
            >
              Save & Reconnect
            </button>
            <button
              type="button"
              onClick={() => {
                setServerInput('');
                setServerBaseUrl('');
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm hover:bg-slate-700 transition"
            >
              Reset Default
            </button>
          </div>
          {savedNotice && (
            <div className="text-xs text-emerald-300">Saved! Reconnecting...</div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <Wifi className="w-5 h-5 text-cyan-400" />
            <h2>Detected LAN Interfaces</h2>
          </div>
          {lanInfo?.addresses.length ? (
            <div className="space-y-2">
              {lanInfo.addresses.map((addr) => (
                <div
                  key={addr.address}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-sm"
                >
                  <div>
                    <span className="font-semibold text-white">{addr.name}</span>
                    {addr.address === lanInfo.primaryIp && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        Recommended
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-amber-300">{addr.url}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No external IPv4 LAN interface detected yet. Connect to a Wi-Fi router or mobile
              hotspot and re-run check.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <Server className="w-5 h-5 text-amber-400" />
            <h2>Starting the Companion Service</h2>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            <li>
              In the project folder, run{' '}
              <code className="px-2 py-0.5 rounded bg-slate-950 text-amber-300">
                npm run build && npm start
              </code>{' '}
              (or double-click <code className="px-2 py-0.5 rounded bg-slate-950 text-amber-300">start-host.bat</code> on Windows).
            </li>
            <li>Ensure the host computer and all player phones are on the exact same Wi-Fi SSID (avoid Guest Wi-Fi with AP isolation).</li>
            <li>Open the displayed <code className="px-2 py-0.5 rounded bg-slate-950 text-cyan-300">http://&lt;LAN-IP&gt;:3001</code> URL in the host browser or scan the room QR code on phones.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="w-5 h-5" />
            <h2>If Phones Cannot Connect (Firewall Checklist)</h2>
          </div>
          <p className="text-sm text-slate-300">
            On Windows, allow inbound TCP port <code className="font-mono">3001</code> (or Node.js) on
            Private networks in PowerShell (Run as Administrator):
          </p>
          <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 overflow-x-auto">
            New-NetFirewallRule -DisplayName "LUDO ARENA LAN" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
          </pre>
        </section>
      </div>
    </LayoutShell>
  );
}
