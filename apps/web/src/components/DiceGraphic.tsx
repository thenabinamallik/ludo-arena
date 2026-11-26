import { motion } from 'framer-motion';
import { COLOR_PALETTE, type PlayerColor } from '@ludo-arena/shared-types';

const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

export function DiceGraphic({
  value,
  rolling = false,
  accentColor,
  size = 76,
}: {
  value: number | null;
  rolling?: boolean;
  accentColor?: PlayerColor | null;
  size?: number;
}) {
  const displayValue = value ?? 1;
  const pips = PIP_POSITIONS[displayValue] ?? PIP_POSITIONS[1];
  const palette = accentColor ? COLOR_PALETTE[accentColor] : null;

  return (
    <motion.div
      animate={
        rolling
          ? {
              rotate: [0, -18, 18, -12, 12, 0],
              scale: [1, 1.12, 0.94, 1.08, 1],
            }
          : value !== null
            ? { scale: [0.82, 1.08, 1], rotate: [12, -4, 0] }
            : { scale: 1, rotate: 0 }
      }
      transition={{ duration: rolling ? 0.45 : 0.32, repeat: rolling ? Infinity : 0 }}
      className="inline-flex items-center justify-center rounded-2xl shadow-lg"
      style={{
        width: size,
        height: size,
        boxShadow: palette ? `0 0 0 3px ${palette.primary}66, 0 10px 24px rgba(0,0,0,0.35)` : undefined,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="dice-face-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="20"
          fill="url(#dice-face-grad)"
          stroke={palette ? palette.primary : '#94A3B8'}
          strokeWidth="5"
        />
        {value === null && !rolling ? (
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="36"
            fontWeight="800"
            fill="#64748B"
          >
            ?
          </text>
        ) : (
          pips.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={displayValue === 1 ? 11 : 8.5}
              fill={displayValue === 1 || displayValue === 6 ? (palette?.primary ?? '#E11D48') : '#0F172A'}
            />
          ))
        )}
      </svg>
    </motion.div>
  );
}
