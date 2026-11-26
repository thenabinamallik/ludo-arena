import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Save } from 'lucide-react';
import {
  ALL_PLAYER_COLORS,
  COLOR_PALETTE,
  RULE_PRESETS,
  type ColorMode,
  type GameRulesConfig,
  type PlayerColor,
  type SafeZoneMode,
  type TurnTimeoutSeconds,
} from '@ludo-arena/shared-types';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';
import { getHostSession } from '../services/sessionStorage';
import { emitAck } from '../services/socketClient';

export function GameConfigPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { roomState, recoverHost } = useArena();
  const hostSession = getHostSession(roomId);

  const [rules, setRules] = useState<GameRulesConfig>(
    roomState?.rules ?? RULE_PRESETS.classic
  );
  const [colorMode, setColorMode] = useState<ColorMode>(roomState?.colorMode ?? 'auto');
  const [availableColors, setAvailableColors] = useState<PlayerColor[]>(
    roomState?.availableColors ?? ['red', 'green', 'yellow', 'blue']
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomState && hostSession) {
      void recoverHost(roomId, hostSession.hostToken);
    }
  }, [roomId, roomState, hostSession, recoverHost]);

  useEffect(() => {
    if (roomState) {
      setRules(roomState.rules);
      setColorMode(roomState.colorMode);
      setAvailableColors(roomState.availableColors);
    }
  }, [roomState]);

  if (!hostSession) {
    return (
      <LayoutShell>
        <div className="max-w-xl mx-auto p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Host Authorization Required</h1>
          <p className="text-slate-400 text-sm">
            Only the host device that created room {roomId} can modify room configuration.
          </p>
          <Link to="/" className="inline-block px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold">
            Return Home
          </Link>
        </div>
      </LayoutShell>
    );
  }

  const minColors = roomState?.playerCountMode ?? 4;

  const toggleColor = (c: PlayerColor) => {
    setAvailableColors((prev) => {
      if (prev.includes(c)) {
        return prev.length <= minColors ? prev : prev.filter((x) => x !== c);
      }
      return [...prev, c];
    });
  };

  const handleSave = async () => {
    setError(null);
    setStatusMsg(null);
    const res = await emitAck('room:update_rules', {
      roomId,
      hostToken: hostSession.hostToken,
      rules,
      colorMode,
      availableColors,
    });
    if (!res.ok) {
      setError(res.error ?? 'Failed to update configuration');
      return;
    }
    setStatusMsg('Configuration saved and synced to all devices!');
    setTimeout(() => navigate(`/host/${roomId}`), 600);
  };

  return (
    <LayoutShell>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to={`/host/${roomId}`}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Host Dashboard
          </Link>
          <span className="font-mono text-xs px-3 py-1 rounded-full bg-slate-800 text-amber-300">
            ROOM {roomId}
          </span>
        </div>

        <h1 className="text-3xl font-black text-white">Configure Match Rules</h1>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm">
            {statusMsg}
          </div>
        )}

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Colour Assignment Mode</span>
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              {(['auto', 'manual'] as ColorMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setColorMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    colorMode === m ? 'bg-indigo-500 text-white' : 'text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_PLAYER_COLORS.map((c) => {
              const active = availableColors.includes(c);
              const pal = COLOR_PALETTE[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                    active ? 'border-white/70' : 'border-slate-800 opacity-45'
                  }`}
                  style={{
                    backgroundColor: active ? pal.primary : '#0F172A',
                    color: active ? pal.textOnPrimary : '#94A3B8',
                  }}
                >
                  {active && <Check className="w-3.5 h-3.5" />}
                  {pal.name}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2">
            {(
              [
                ['requireSixToLeaveBase', 'Require 6 to leave base'],
                ['extraTurnOnSix', 'Extra turn on rolling 6'],
                ['extraTurnOnCapture', 'Extra turn on capture'],
                ['extraTurnOnHome', 'Extra turn on reaching Home'],
                ['threeConsecutiveSixesRule', 'Three 6s forfeits turn'],
                ['teamMode', 'Team Mode'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <span className="text-slate-200">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(rules[key])}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, [key]: e.target.checked, preset: 'custom' }))
                  }
                  className="w-4 h-4 accent-amber-400"
                />
              </label>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Turn Timer</label>
              <select
                value={rules.turnTimeoutSeconds}
                onChange={(e) =>
                  setRules((r) => ({
                    ...r,
                    turnTimeoutSeconds: Number(e.target.value) as TurnTimeoutSeconds,
                    preset: 'custom',
                  }))
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white text-sm"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Safe Zones</label>
              <select
                value={rules.safeZoneMode}
                onChange={(e) =>
                  setRules((r) => ({
                    ...r,
                    safeZoneMode: e.target.value as SafeZoneMode,
                    preset: 'custom',
                  }))
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white text-sm"
              >
                <option value="standard">Standard (Starts + Stars)</option>
                <option value="starts_only">Starts Only</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center gap-2 hover:bg-emerald-400 transition"
          >
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </div>
    </LayoutShell>
  );
}
