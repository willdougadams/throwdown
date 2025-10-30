import { useMemo } from 'react';

/**
 * Custom hook to extract player-specific state from raw game data
 * Provides helper functions to check player status without duplicating logic
 */
export function usePlayerGameState(
  rawGameData: any | null,
  gameData: any | null,
  playerPublicKey: string | null
) {
  return useMemo(() => {
    if (!playerPublicKey || !rawGameData) {
      return {
        isInGame: false,
        hasSubmittedMoves: false,
        hasRevealedMoves: false,
        hasOpponentSubmittedMoves: false,
        playerSlot: undefined,
        opponentSlot: undefined
      };
    }

    // Find player in game
    const player = rawGameData.players?.find((p: any) =>
      (p.pubkey || p.toString()) === playerPublicKey
    );

    const isInGame = !!player;
    const playerSlot = player?.slot;

    // Check if player has submitted moves
    const hasSubmittedMoves = (() => {
      if (!player || !player.moves_committed) return false;

      const movesCommitted = Array.isArray(player.moves_committed)
        ? player.moves_committed
        : Array.from(player.moves_committed);

      return movesCommitted.some((byte: any) => {
        const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
        return !isNaN(byteValue) && byteValue !== 0;
      });
    })();

    // Check if player has revealed moves
    const hasRevealedMoves = (() => {
      if (!player || !player.moves_revealed || !gameData) return false;
      const currentRound = gameData.currentRound;
      // moves_revealed is now [round][move_index]
      return player.moves_revealed[currentRound]?.[0] !== null;
    })();

    // Check if opponent has submitted moves
    const hasOpponentSubmittedMoves = (() => {
      if (!player || !gameData || playerSlot === undefined) return false;

      const currentRound = gameData.currentRound;
      if (!rawGameData.bracket || !rawGameData.bracket[currentRound]) return false;

      const roundBracket = rawGameData.bracket[currentRound];
      const userPosition = roundBracket.indexOf(playerSlot);

      if (userPosition === -1) return false;

      // Find opponent position
      const opponentPosition = userPosition % 2 === 0 ? userPosition + 1 : userPosition - 1;
      const opponentSlotIndex = roundBracket[opponentPosition];

      if (opponentSlotIndex === undefined || opponentSlotIndex === 255) return false;

      // Find opponent player
      const opponentPlayer = rawGameData.players?.find((p: any) => p.slot === opponentSlotIndex);
      if (!opponentPlayer || !opponentPlayer.moves_committed) return false;

      const movesCommitted = Array.isArray(opponentPlayer.moves_committed)
        ? opponentPlayer.moves_committed
        : Array.from(opponentPlayer.moves_committed);

      return movesCommitted.some((byte: any) => {
        const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
        return !isNaN(byteValue) && byteValue !== 0;
      });
    })();

    // Find opponent slot for current round
    const opponentSlot = (() => {
      if (!player || !gameData || playerSlot === undefined) return undefined;

      const currentRound = gameData.currentRound;
      if (!rawGameData.bracket || !rawGameData.bracket[currentRound]) return undefined;

      const roundBracket = rawGameData.bracket[currentRound];
      const userPosition = roundBracket.indexOf(playerSlot);

      if (userPosition === -1) return undefined;

      const opponentPosition = userPosition % 2 === 0 ? userPosition + 1 : userPosition - 1;
      return roundBracket[opponentPosition];
    })();

    return {
      isInGame,
      hasSubmittedMoves,
      hasRevealedMoves,
      hasOpponentSubmittedMoves,
      playerSlot,
      opponentSlot
    };
  }, [rawGameData, gameData, playerPublicKey]);
}
