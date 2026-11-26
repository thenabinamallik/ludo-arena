import { BookOpen, Music, Moon, Shield, Sun, Volume2 } from 'lucide-react';
import { LayoutShell } from '../components/LayoutShell';
import { useArena } from '../hooks/useRoomSession';

export function SettingsRulesPage() {
  const { preferences, toggleTheme, toggleSound, toggleMusic } = useArena();

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white">Settings & Official Rules</h1>
          <p className="text-sm text-slate-400 mt-1">
            Customize audio, theme appearance, and review LUDO ARENA gameplay rules.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 space-y-4">
          <h2 className="font-bold text-white">Device Preferences</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                {preferences.theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                Theme
              </span>
              <span className="text-xs font-bold uppercase text-amber-300">
                {preferences.theme}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Sound Effects
              </span>
              <span className="text-xs font-bold uppercase text-emerald-300">
                {preferences.soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleMusic}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Music className="w-4 h-4 text-cyan-400" /> Music
              </span>
              <span className="text-xs font-bold uppercase text-cyan-300">
                {preferences.musicEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2>LUDO ARENA Rulebook</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="font-bold text-white">Leaving Base & Movement</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                By default, rolling a 6 moves a pawn from its colored Base onto your Start square.
                Pawns travel clockwise around the outer track before entering their colored 5-cell
                Home Stretch.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="font-bold text-white">Captures & Safe Zones</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Landing on an opponent pawn on an unprotected cell sends it back to its Base. Start
                squares and Star squares protect all pawns from capture.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="font-bold text-white">Extra Turns & Three-Sixes</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rolling a 6, capturing an opponent, or reaching Home awards an extra roll (configurable
                by host). Rolling three consecutive 6s forfeits your turn if enabled.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> Exact Home Entry & Boards
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                You must roll the exact remaining steps to enter Center Home. 2P uses opposite corners;
                4P uses the 52-cell classic cross; 6P uses a 78-cell hexagonal board; 8P uses a
                104-cell octagonal board.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}
