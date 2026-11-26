export type PlayerColor =
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'cyan';

export const ALL_PLAYER_COLORS: PlayerColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
  'orange',
  'purple',
  'pink',
  'cyan',
];

export const COLOR_PALETTE: Record<
  PlayerColor,
  {
    name: string;
    primary: string;
    light: string;
    dark: string;
    ring: string;
    textOnPrimary: string;
  }
> = {
  red: {
    name: 'Red',
    primary: '#E11D48',
    light: '#FFE4E6',
    dark: '#9F1239',
    ring: '#FB7185',
    textOnPrimary: '#FFFFFF',
  },
  green: {
    name: 'Green',
    primary: '#16A34A',
    light: '#DCFCE7',
    dark: '#166534',
    ring: '#4ADE80',
    textOnPrimary: '#FFFFFF',
  },
  yellow: {
    name: 'Yellow',
    primary: '#EAB308',
    light: '#FEF9C3',
    dark: '#854D0E',
    ring: '#FACC15',
    textOnPrimary: '#1E293B',
  },
  blue: {
    name: 'Blue',
    primary: '#2563EB',
    light: '#DBEAFE',
    dark: '#1E40AF',
    ring: '#60A5FA',
    textOnPrimary: '#FFFFFF',
  },
  orange: {
    name: 'Orange',
    primary: '#EA580C',
    light: '#FFEDD5',
    dark: '#9A3412',
    ring: '#FB923C',
    textOnPrimary: '#FFFFFF',
  },
  purple: {
    name: 'Purple',
    primary: '#9333EA',
    light: '#F3E8FF',
    dark: '#6B21A8',
    ring: '#C084FC',
    textOnPrimary: '#FFFFFF',
  },
  pink: {
    name: 'Pink',
    primary: '#DB2777',
    light: '#FCE7F3',
    dark: '#9D174D',
    ring: '#F472B6',
    textOnPrimary: '#FFFFFF',
  },
  cyan: {
    name: 'Cyan',
    primary: '#0891B2',
    light: '#CFFAFE',
    dark: '#155E75',
    ring: '#22D3EE',
    textOnPrimary: '#FFFFFF',
  },
};

export type PlayerCountMode = 2 | 4 | 6 | 8;
export type ColorMode = 'auto' | 'manual';
export type SafeZoneMode = 'standard' | 'starts_only' | 'none';
export type TurnTimeoutSeconds = 15 | 30 | 60;
export type RulePreset = 'classic' | 'quick' | 'team_battle' | 'custom';

export interface GameRulesConfig {
  preset: RulePreset;
  requireSixToLeaveBase: boolean;
  extraTurnOnSix: boolean;
  extraTurnOnCapture: boolean;
  extraTurnOnHome: boolean;
  threeConsecutiveSixesRule: boolean;
  safeZoneMode: SafeZoneMode;
  turnTimeoutSeconds: TurnTimeoutSeconds;
  teamMode: boolean;
}

export const RULE_PRESETS: Record<Exclude<RulePreset, 'custom'>, GameRulesConfig> = {
  classic: {
    preset: 'classic',
    requireSixToLeaveBase: true,
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeConsecutiveSixesRule: true,
    safeZoneMode: 'standard',
    turnTimeoutSeconds: 30,
    teamMode: false,
  },
  quick: {
    preset: 'quick',
    requireSixToLeaveBase: false,
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeConsecutiveSixesRule: false,
    safeZoneMode: 'starts_only',
    turnTimeoutSeconds: 15,
    teamMode: false,
  },
  team_battle: {
    preset: 'team_battle',
    requireSixToLeaveBase: true,
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeConsecutiveSixesRule: true,
    safeZoneMode: 'standard',
    turnTimeoutSeconds: 30,
    teamMode: true,
  },
};

export type PlayerAvatar =
  | 'crown'
  | 'rocket'
  | 'fox'
  | 'dragon'
  | 'gem'
  | 'bolt'
  | 'star'
  | 'shield'
  | 'lion'
  | 'owl'
  | 'flame'
  | 'comet';

export const PLAYER_AVATARS: PlayerAvatar[] = [
  'crown',
  'rocket',
  'fox',
  'dragon',
  'gem',
  'bolt',
  'star',
  'shield',
  'lion',
  'owl',
  'flame',
  'comet',
];

export type PawnZone = 'base' | 'track' | 'home_stretch' | 'home';
export type PawnNumber = 1 | 2 | 3 | 4;

export interface PawnState {
  id: string;
  pawnNumber: PawnNumber;
  playerId: string;
  color: PlayerColor;
  zone: PawnZone;
  /**
   * -1 = in base
   * 0..(mainTrackLength - 1) = steps along player's track from start cell
   * mainTrackLength..(totalSteps - 1) = home stretch
   * totalSteps = inside center home
   */
  progress: number;
  trackIndex: number | null;
  homeStretchIndex: number | null;
}

export interface PlayerMatchStats {
  rolls: number;
  sixes: number;
  moves: number;
  captures: number;
  capturedCount: number;
  pawnsHome: number;
  timeouts: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  color: PlayerColor | null;
  teamId: number | null;
  ready: boolean;
  connected: boolean;
  seatIndex: number;
  joinedAt: number;
  lastSeenAt: number;
  stats: PlayerMatchStats;
}

export interface SpectatorInfo {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

export type MatchStatus = 'lobby' | 'playing' | 'paused' | 'finished';
export type TurnPhase = 'waiting_for_roll' | 'waiting_for_move' | 'finished';

export interface MoveOption {
  pawnId: string;
  pawnNumber: PawnNumber;
  fromZone: PawnZone;
  toZone: PawnZone;
  fromProgress: number;
  toProgress: number;
  willCapture: boolean;
  capturedPawnIds: string[];
  willReachHome: boolean;
  grantsExtraTurn: boolean;
}

export type NotificationType =
  | 'info'
  | 'roll'
  | 'move'
  | 'capture'
  | 'home'
  | 'extra_turn'
  | 'timeout'
  | 'penalty'
  | 'victory'
  | 'system';

export interface GameNotification {
  id: string;
  type: NotificationType;
  message: string;
  playerId?: string;
  color?: PlayerColor;
  timestamp: number;
}

export interface MatchState {
  roomId: string;
  version: number;
  status: MatchStatus;
  playerCountMode: PlayerCountMode;
  turnPhase: TurnPhase;
  activePlayerId: string | null;
  turnOrder: string[];
  currentDiceValue: number | null;
  consecutiveSixes: number;
  legalMoves: MoveOption[];
  turnStartedAt: number | null;
  turnExpiresAt: number | null;
  pausedRemainingTurnMs: number | null;
  pawns: Record<string, PawnState>;
  rankings: string[];
  winningTeamId: number | null;
  turnCount: number;
  startedAt: number | null;
  finishedAt: number | null;
  processedActionIds: string[];
  lastEvent: GameNotification | null;
}

export interface RoomState {
  roomId: string;
  version: number;
  hostConnected: boolean;
  playerCountMode: PlayerCountMode;
  maxPlayers: PlayerCountMode;
  colorMode: ColorMode;
  availableColors: PlayerColor[];
  rules: GameRulesConfig;
  players: PlayerInfo[];
  spectators: SpectatorInfo[];
  match: MatchState | null;
  notifications: GameNotification[];
  createdAt: number;
  updatedAt: number;
}

export interface MatchHistoryRecord {
  id: string;
  roomId: string;
  playerCountMode: PlayerCountMode;
  teamMode: boolean;
  winnerId: string | null;
  winnerName: string | null;
  winnerColor: PlayerColor | null;
  winningTeamId: number | null;
  rankings: Array<{
    playerId: string;
    name: string;
    color: PlayerColor;
    avatar: PlayerAvatar;
    rank: number;
    teamId: number | null;
    stats: PlayerMatchStats;
  }>;
  turnCount: number;
  durationMs: number;
  rules: GameRulesConfig;
  startedAt: number;
  finishedAt: number;
}

export interface LanNetworkInfo {
  port: number;
  hostname: string;
  primaryIp: string | null;
  addresses: Array<{
    name: string;
    address: string;
    url: string;
  }>;
  companionReady: boolean;
}

export interface SocketAck<T = unknown> {
  ok: boolean;
  error?: string;
  code?: string;
  data?: T;
}

// Socket.IO event payloads
export interface CreateRoomPayload {
  playerCountMode: PlayerCountMode;
  colorMode?: ColorMode;
  availableColors?: PlayerColor[];
  rules?: Partial<GameRulesConfig>;
  hostName?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  hostToken: string;
  roomState: RoomState;
}

export interface JoinRoomPayload {
  roomId: string;
  name: string;
  avatar?: PlayerAvatar;
  preferredColor?: PlayerColor;
  spectator?: boolean;
  sessionToken?: string;
}

export interface JoinRoomResponse {
  roomId: string;
  role: 'player' | 'spectator';
  participantId: string;
  sessionToken: string;
  roomState: RoomState;
}

export interface ReconnectHostPayload {
  roomId: string;
  hostToken: string;
}

export interface PlayerReadyPayload {
  roomId: string;
  playerId: string;
  sessionToken: string;
  ready: boolean;
}

export interface AssignColorPayload {
  roomId: string;
  hostToken?: string;
  sessionToken?: string;
  targetPlayerId: string;
  color: PlayerColor;
}

export interface RemovePlayerPayload {
  roomId: string;
  hostToken: string;
  targetPlayerId: string;
}

export interface UpdateRulesPayload {
  roomId: string;
  hostToken: string;
  rules: Partial<GameRulesConfig>;
  colorMode?: ColorMode;
  availableColors?: PlayerColor[];
}

export interface HostActionPayload {
  roomId: string;
  hostToken: string;
}

export interface DiceRollPayload {
  roomId: string;
  playerId: string;
  sessionToken: string;
  actionId: string;
  expectedVersion?: number;
}

export interface PawnMovePayload {
  roomId: string;
  playerId: string;
  sessionToken: string;
  pawnId: string;
  actionId: string;
  expectedVersion?: number;
}

export interface DiceResultEvent {
  roomId: string;
  playerId: string;
  color: PlayerColor;
  diceValue: number;
  consecutiveSixes: number;
  legalMoves: MoveOption[];
  forfeitedByThreeSixes: boolean;
  noLegalMoves: boolean;
  version: number;
}

export interface PawnMovedEvent {
  roomId: string;
  playerId: string;
  pawnId: string;
  fromProgress: number;
  toProgress: number;
  capturedPawnIds: string[];
  reachedHome: boolean;
  grantsExtraTurn: boolean;
  version: number;
}

export interface TurnChangedEvent {
  roomId: string;
  activePlayerId: string | null;
  turnPhase: TurnPhase;
  turnExpiresAt: number | null;
  reason: 'next_player' | 'extra_turn' | 'timeout' | 'three_sixes' | 'no_moves' | 'match_start';
  version: number;
}

export interface GameFinishedEvent {
  roomId: string;
  winnerId: string | null;
  winningTeamId: number | null;
  rankings: string[];
  historyRecord: MatchHistoryRecord;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: CreateRoomPayload,
    cb: (res: SocketAck<CreateRoomResponse>) => void
  ) => void;
  'room:join': (
    payload: JoinRoomPayload,
    cb: (res: SocketAck<JoinRoomResponse>) => void
  ) => void;
  'room:leave': (
    payload: { roomId: string; participantId: string; sessionToken: string },
    cb: (res: SocketAck) => void
  ) => void;
  'host:recover': (
    payload: ReconnectHostPayload,
    cb: (res: SocketAck<{ roomState: RoomState }>) => void
  ) => void;
  'player:ready': (payload: PlayerReadyPayload, cb: (res: SocketAck) => void) => void;
  'player:assign_color': (payload: AssignColorPayload, cb: (res: SocketAck) => void) => void;
  'player:kick': (payload: RemovePlayerPayload, cb: (res: SocketAck) => void) => void;
  'room:update_rules': (payload: UpdateRulesPayload, cb: (res: SocketAck) => void) => void;
  'game:start': (payload: HostActionPayload, cb: (res: SocketAck) => void) => void;
  'game:pause': (payload: HostActionPayload, cb: (res: SocketAck) => void) => void;
  'game:resume': (payload: HostActionPayload, cb: (res: SocketAck) => void) => void;
  'game:restart': (payload: HostActionPayload, cb: (res: SocketAck) => void) => void;
  'game:end': (payload: HostActionPayload, cb: (res: SocketAck) => void) => void;
  'dice:roll': (payload: DiceRollPayload, cb: (res: SocketAck<DiceResultEvent>) => void) => void;
  'pawn:move': (payload: PawnMovePayload, cb: (res: SocketAck<PawnMovedEvent>) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'player:disconnect': (payload: { roomId: string; playerId: string; name: string }) => void;
  'dice:result': (event: DiceResultEvent) => void;
  'pawn:moved': (event: PawnMovedEvent) => void;
  'turn:changed': (event: TurnChangedEvent) => void;
  'game:finished': (event: GameFinishedEvent) => void;
  'room:closed': (payload: { roomId: string; reason: string }) => void;
}
