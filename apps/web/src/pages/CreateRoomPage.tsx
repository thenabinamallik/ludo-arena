import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Play, ShieldCheck, Users } from 'lucide-react';
import {
  ALL_PLAYER_COLORS,
  COLOR_PALETTE,
  RULE_PRESETS,
  type ColorMode,
  type CreateRoomResponse,
  type GameRulesConfig,
  type PlayerColor,
  type PlayerCountMode,
  type RulePreset,
  type SafeZoneMode,
  type TurnTimeoutSeconds,
} from '@ludo-arena/shared-types';
import { getBoardConfig } from '@ludo-arena/board-config';
import { LayoutShell } from '../components/LayoutShell';
import { saveHostSession } from '../services/sessionStorage';
import { emitAck } from '../services/socketClient';

export function CreateRoomPage() {
  const navigate = useNavigate();
  const [playerCountMode, setPlayerCountMode] = useState<PlayerCountMode>(4);
  const [colorMode, setColorMode] = useState<ColorMode>('auto');
  const [availableColors, setAvailableColors] = useState<PlayerColor[]>(
    getBoardConfig(4).defaultColors
  );
  const [rules, setRules] = useState<GameRulesConfig>(RULE_PRESETS.classic);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (mode: PlayerCountMode) => {
    setPlayerCountMode(mode);
    setAvailableColors(getBoardConfig(mode).defaultColors);
  };

  const toggleColor = (color: PlayerColor) => {
    setAvailableColors((prev) => {
      if (prev.includes(color)) {
        if (prev.length <= playerCountMode) return prev;
        return prev.filter((c) => c !== color);
      }
      return [...prev, color];
    });
  };

  const applyPreset = (preset: Exclude<RulePreset, 'custom'>) => {
    setRules(RULE_PRESETS[preset]);
  };

  const updateRule = <K extends keyof GameRulesConfig>(key: K, val: GameRulesConfig[K]) => {
    setRules((prev) => ({ ...prev, [key]: val, preset: 'custom' }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await emitAck<CreateRoomResponse>('room:create', {
      playerCountMode,
      colorMode,
      availableColors,
      rules,
    });

    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Failed to create room. Is the companion service running?');
      return;
    }

    saveHostSession({
      roomId: res.data.roomId,
      hostToken: res.data.hostToken,
      createdAt: Date.now(),
    });
    navigate(`/host/${res.data.roomId}`);
  };

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <h1 className="text-3xl font-black text-white">Create LAN Match Room</h1>
            <p className="text-slate-400 mt-1">
              Configure board size, player colours, and server-enforced rules.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 text-rose-200 text-sm">
              {error}
            </div>
          )}

          {/* Player Count Mode */}
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-white">
              <Users className="w-5 h-5 text-amber-400" />
              <h2>Player Capacity & Board Geometry</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([2, 4, 6, 8] as PlayerCountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleModeChange(mode)}
                  className={`p-4 rounded-2xl border text-left transition ${
                    playerCountMode === mode
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="text-2xl font-black">{mode} Players</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {mode === 2
                      ? 'Opposite Corners'
                      : mode === 4
                        ? 'Classic 15×15 Cross'
                        : mode === 6
                          ? '6-Arm Hexagonal'
                          : '8-Arm Octagonal'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Colour Configuration */}
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-white">Player Colour Assignment</h2>
              <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                {(['auto', 'manual'] as ColorMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setColorMode(m)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                      colorMode === m
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'auto' ? 'Auto Assign' : 'Manual Pick'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Select at least {playerCountMode} colours enabled for this room (currently{' '}
              {availableColors.length} selected).
            </p>
            <div className="flex flex-wrap gap-2.5">
              {ALL_PLAYER_COLORS.map((c) => {
                const active = availableColors.includes(c);
                const pal = COLOR_PALETTE[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleColor(c)}
                    className={`px-3.5 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition ${
                      active
                        ? 'border-white/70 shadow-md scale-[1.02]'
                        : 'border-slate-800 opacity-45 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: active ? pal.primary : '#0F172A',
                      color: active ? pal.textOnPrimary : '#94A3B8',
                    }}
                  >
                    {active && <Check className="w-4 h-4" />}
                    {pal.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Game Rules & Presets */}
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2>Game Rules & Presets</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['classic', 'quick', 'team_battle'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition ${
                      rules.preset === p
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { key: 'requireSixToLeaveBase' as const, label: 'Require 6 to leave base' },
                { key: 'extraTurnOnSix' as const, label: 'Extra turn on rolling 6' },
                { key: 'extraTurnOnCapture' as const, label: 'Extra turn on capturing opponent' },
                { key: 'extraTurnOnHome' as const, label: 'Extra turn on reaching Home' },
                { key: 'threeConsecutiveSixesRule' as const, label: 'Three consecutive 6s forfeits turn' },
                { key: 'teamMode' as const, label: 'Team Mode (paired seats)' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer"
                >
                  <span className="text-slate-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(rules[item.key])}
                    onChange={(e) => updateRule(item.key, e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Turn Timer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 30, 60] as TurnTimeoutSeconds[]).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateRule('turnTimeoutSeconds', sec)}
                      className={`py-2 rounded-xl text-sm font-bold border ${
                        rules.turnTimeoutSeconds === sec
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Safe Zones
                </label>
                <select
                  value={rules.safeZoneMode}
                  onChange={(e) => updateRule('safeZoneMode', e.target.value as SafeZoneMode)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="standard">Standard (Starts + Stars)</option>
                  <option value="starts_only">Start Squares Only</option>
                  <option value="none">No Safe Zones (Hardcore)</option>
                </select>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-lg shadow-xl hover:brightness-105 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            {submitting ? 'Creating Room...' : 'Create Room & Open Host Dashboard'}
          </button>
        </form>
      </div>
    </LayoutShell>
  );
}
