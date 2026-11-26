import { describe, expect, it } from 'vitest';
import {
  createRoomSchema,
  diceRollSchema,
  joinRoomSchema,
  pawnMoveSchema,
} from '@ludo-arena/validation';

describe('Zod Validation Schemas', () => {
  it('validates room creation modes and rejects invalid counts', () => {
    expect(createRoomSchema.safeParse({ playerCountMode: 4 }).success).toBe(true);
    expect(createRoomSchema.safeParse({ playerCountMode: 6 }).success).toBe(true);
    expect(createRoomSchema.safeParse({ playerCountMode: 8 }).success).toBe(true);
    expect(createRoomSchema.safeParse({ playerCountMode: 5 }).success).toBe(false);
  });

  it('normalizes roomId and rejects invalid player names', () => {
    const valid = joinRoomSchema.safeParse({ roomId: ' ab12cd ', name: 'Nabin' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.roomId).toBe('AB12CD');
    }

    expect(joinRoomSchema.safeParse({ roomId: 'AB', name: 'Nabin' }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ roomId: 'AB12CD', name: '' }).success).toBe(false);
  });

  it('validates dice roll and pawn move payloads', () => {
    expect(
      diceRollSchema.safeParse({
        roomId: 'ABC123',
        playerId: 'pl-1',
        sessionToken: 'token-12345678',
        actionId: 'act-1',
      }).success
    ).toBe(true);

    expect(
      pawnMoveSchema.safeParse({
        roomId: 'ABC123',
        playerId: 'pl-1',
        sessionToken: 'short',
        pawnId: 'pl-1-p1',
        actionId: 'act-2',
      }).success
    ).toBe(false);
  });
});
