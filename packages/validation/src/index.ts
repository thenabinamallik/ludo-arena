import { z } from 'zod';

export const playerColorSchema = z.enum([
  'red',
  'green',
  'yellow',
  'blue',
  'orange',
  'purple',
  'pink',
  'cyan',
]);

export const playerCountModeSchema = z.union([
  z.literal(2),
  z.literal(4),
  z.literal(6),
  z.literal(8),
]);

export const colorModeSchema = z.enum(['auto', 'manual']);
export const safeZoneModeSchema = z.enum(['standard', 'starts_only', 'none']);
export const turnTimeoutSchema = z.union([z.literal(15), z.literal(30), z.literal(60)]);
export const rulePresetSchema = z.enum(['classic', 'quick', 'team_battle', 'custom']);

export const playerAvatarSchema = z.enum([
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
]);

export const gameRulesSchema = z.object({
  preset: rulePresetSchema,
  requireSixToLeaveBase: z.boolean(),
  extraTurnOnSix: z.boolean(),
  extraTurnOnCapture: z.boolean(),
  extraTurnOnHome: z.boolean(),
  threeConsecutiveSixesRule: z.boolean(),
  safeZoneMode: safeZoneModeSchema,
  turnTimeoutSeconds: turnTimeoutSchema,
  teamMode: z.boolean(),
});

export const partialRulesSchema = gameRulesSchema.partial();

export const roomIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/, 'Room ID must be 4-8 alphanumeric characters');

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Player name is required')
  .max(20, 'Player name must be 20 characters or less');

export const createRoomSchema = z.object({
  playerCountMode: playerCountModeSchema,
  colorMode: colorModeSchema.optional(),
  availableColors: z.array(playerColorSchema).min(2).max(8).optional(),
  rules: partialRulesSchema.optional(),
  hostName: z.string().trim().max(24).optional(),
});

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  name: playerNameSchema,
  avatar: playerAvatarSchema.optional(),
  preferredColor: playerColorSchema.optional(),
  spectator: z.boolean().optional(),
  sessionToken: z.string().min(8).max(128).optional(),
});

export const leaveRoomSchema = z.object({
  roomId: roomIdSchema,
  participantId: z.string().min(1),
  sessionToken: z.string().min(8),
});

export const reconnectHostSchema = z.object({
  roomId: roomIdSchema,
  hostToken: z.string().min(8),
});

export const playerReadySchema = z.object({
  roomId: roomIdSchema,
  playerId: z.string().min(1),
  sessionToken: z.string().min(8),
  ready: z.boolean(),
});

export const assignColorSchema = z.object({
  roomId: roomIdSchema,
  hostToken: z.string().min(8).optional(),
  sessionToken: z.string().min(8).optional(),
  targetPlayerId: z.string().min(1),
  color: playerColorSchema,
});

export const removePlayerSchema = z.object({
  roomId: roomIdSchema,
  hostToken: z.string().min(8),
  targetPlayerId: z.string().min(1),
});

export const updateRulesSchema = z.object({
  roomId: roomIdSchema,
  hostToken: z.string().min(8),
  rules: partialRulesSchema,
  colorMode: colorModeSchema.optional(),
  availableColors: z.array(playerColorSchema).min(2).max(8).optional(),
});

export const hostActionSchema = z.object({
  roomId: roomIdSchema,
  hostToken: z.string().min(8),
});

export const diceRollSchema = z.object({
  roomId: roomIdSchema,
  playerId: z.string().min(1),
  sessionToken: z.string().min(8),
  actionId: z.string().min(4).max(100),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const pawnMoveSchema = z.object({
  roomId: roomIdSchema,
  playerId: z.string().min(1),
  sessionToken: z.string().min(8),
  pawnId: z.string().min(1),
  actionId: z.string().min(4).max(100),
  expectedVersion: z.number().int().nonnegative().optional(),
});
