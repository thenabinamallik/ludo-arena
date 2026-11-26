import {
  Award,
  Bolt,
  Compass,
  Crown,
  Flame,
  Gem,
  Heart,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Swords,
} from 'lucide-react';
import { COLOR_PALETTE, type PlayerAvatar, type PlayerColor } from '@ludo-arena/shared-types';

const AVATAR_ICON: Record<PlayerAvatar, React.ComponentType<{ className?: string }>> = {
  crown: Crown,
  rocket: Rocket,
  fox: Flame,
  dragon: Swords,
  gem: Gem,
  bolt: Bolt,
  star: Star,
  shield: Shield,
  lion: Award,
  owl: Compass,
  flame: Sparkles,
  comet: Heart,
};

export function AvatarBadge({
  avatar,
  color,
  size = 'md',
}: {
  avatar: PlayerAvatar;
  color: PlayerColor | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = AVATAR_ICON[avatar] ?? Crown;
  const palette = color ? COLOR_PALETTE[color] : null;
  const sizeClass =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iconClass =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center shrink-0 shadow-md border border-white/20`}
      style={{
        backgroundColor: palette ? palette.primary : '#334155',
        color: palette ? palette.textOnPrimary : '#F8FAFC',
      }}
    >
      <Icon className={iconClass} />
    </div>
  );
}
