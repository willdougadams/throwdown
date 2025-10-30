import React, { useEffect, useRef, useState } from 'react';
import { MatchupTile } from './MatchupTile';
import { Trophy } from 'lucide-react';
import { theme } from '../theme';
import { Move, MatchState, GameState, Player, MatchupPlayerData, Matchup } from '../types/game';

interface GameData {
  id: string;
  state: GameState;
  players: Player[];
  currentRound: number;
  maxPlayers: number;
  winner?: Player;
}

interface BracketDisplayProps {
  gameData: GameData;
  rawGameData: any;
  currentUserPublicKey: string | null;
  onMatchupClick: () => void;
  onRefresh: () => void;
  isUserInGame: boolean;
  onClaimPrize: () => void;
  gameAccountBalance?: number; // Account's actual lamport balance
}

export function BracketDisplay({
  gameData,
  rawGameData,
  currentUserPublicKey,
  onMatchupClick,
  onRefresh,
  isUserInGame,
  onClaimPrize,
  gameAccountBalance
}: BracketDisplayProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const roundRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visibleRoundIndex, setVisibleRoundIndex] = useState(gameData.currentRound);

  // ============================================================================
  // Data Processing Functions
  // ============================================================================

  /**
   * Extract player's revealed moves from raw blockchain data for a specific round
   */
  const getPlayerMoves = (playerPubkey: string, round: number): Move[] | undefined => {
    if (!rawGameData?.players) return undefined;

    const player = rawGameData.players.find((p: any) =>
      (p.pubkey || p.toString()) === playerPubkey
    );

    if (!player || !player.moves_revealed) return undefined;

    // Get moves for the specific round (moves_revealed is now [round][move_index])
    const roundMoves = player.moves_revealed[round];
    if (!roundMoves) return undefined;

    // Filter out null/undefined values
    const moves = roundMoves.filter((m: any) => m !== null && m !== undefined);
    if (moves.length === 0) return undefined;

    // Map enum values to move strings (deserializer converts program's 1-3 to 0-2)
    return moves.map((m: number) => {
      if (m === 0) return 'rock';
      if (m === 1) return 'paper';
      if (m === 2) return 'scissors';
      return 'rock'; // fallback
    }) as Move[];
  };

  /**
   * Check if player has submitted moves (committed hash)
   */
  const hasPlayerSubmittedMoves = (playerPubkey: string): boolean => {
    if (!rawGameData?.players) return false;

    const player = rawGameData.players.find((p: any) =>
      (p.pubkey || p.toString()) === playerPubkey
    );

    if (!player || !player.moves_committed) return false;

    const movesCommitted = Array.isArray(player.moves_committed)
      ? player.moves_committed
      : Array.from(player.moves_committed);

    return movesCommitted.some((byte: any) => {
      const byteValue = typeof byte === 'number' ? byte : parseInt(byte);
      return !isNaN(byteValue) && byteValue !== 0;
    });
  };

  /**
   * Check if player has revealed moves for the current round
   */
  const hasPlayerRevealedMoves = (playerPubkey: string): boolean => {
    if (!rawGameData?.players || !gameData) return false;

    const player = rawGameData.players.find((p: any) =>
      (p.pubkey || p.toString()) === playerPubkey
    );

    const currentRound = gameData.currentRound;
    // moves_revealed is now [round][move_index]
    return player && player.moves_revealed && player.moves_revealed[currentRound]?.[0] !== null;
  };

  /**
   * Find player by slot number
   */
  const findPlayerBySlot = (slotNumber: number): Player | undefined => {
    return gameData.players.find((p: Player & { slot?: number }) => p.slot === slotNumber);
  };

  /**
   * Build MatchupPlayerData with all necessary information
   */
  const buildPlayerData = (
    player: Player | undefined,
    matchState: MatchState,
    matchupRound: number,
    winnerId?: string,
    slot?: number
  ): MatchupPlayerData => {
    if (!player) {
      return {
        player: undefined,
        moves: undefined,
        hasSubmitted: false,
        hasRevealed: false,
        isWinner: false,
        slot
      };
    }

    // Get moves for the specific round this matchup is in (0-indexed)
    const moves = getPlayerMoves(player.publicKey, matchupRound - 1);
    const hasSubmitted = hasPlayerSubmittedMoves(player.publicKey);
    const hasRevealed = hasPlayerRevealedMoves(player.publicKey);
    const isWinner = winnerId === player.id;

    return {
      player,
      moves, // All 5 moves from this specific round
      hasSubmitted,
      hasRevealed,
      isWinner,
      slot: player.slot
    };
  };

  // ============================================================================
  // Bracket Generation
  // ============================================================================

  const numRounds = Math.ceil(Math.log2(gameData.maxPlayers));

  const getMatchCountForRound = (round: number) => {
    return Math.pow(2, numRounds - round);
  };

  const generateBracket = (): Matchup[][] => {
    const bracket: Matchup[][] = [];

    for (let round = 1; round <= numRounds; round++) {
      const matchCount = getMatchCountForRound(round);
      const roundMatches: Matchup[] = [];

      for (let i = 0; i < matchCount; i++) {
        let player1: Player | undefined = undefined;
        let player2: Player | undefined = undefined;
        let player1Slot: number | undefined = undefined;
        let player2Slot: number | undefined = undefined;

        if (round === 1) {
          // First round - pair up players by slot numbers
          player1Slot = i * 2;
          player2Slot = i * 2 + 1;
          player1 = findPlayerBySlot(player1Slot);
          player2 = findPlayerBySlot(player2Slot);
        } else {
          // Future rounds - use bracket data from blockchain
          if (rawGameData?.bracket && rawGameData.bracket[round - 1]) {
            const roundBracket = rawGameData.bracket[round - 1];
            const player1SlotIdx = roundBracket[i * 2];
            const player2SlotIdx = roundBracket[i * 2 + 1];

            if (player1SlotIdx !== undefined && player1SlotIdx !== 255) {
              player1 = findPlayerBySlot(player1SlotIdx);
            }
            if (player2SlotIdx !== undefined && player2SlotIdx !== 255) {
              player2 = findPlayerBySlot(player2SlotIdx);
            }
          }
        }

        // Determine match state
        let matchState: MatchState = 'waiting_for_players';
        if (player1 && player2) {
          if (gameData.currentRound + 1 === round) {
            if (gameData.state === 'in_progress') {
              const p1Submitted = player1 ? hasPlayerSubmittedMoves(player1.publicKey) : false;
              const p2Submitted = player2 ? hasPlayerSubmittedMoves(player2.publicKey) : false;
              const p1Revealed = player1 ? hasPlayerRevealedMoves(player1.publicKey) : false;
              const p2Revealed = player2 ? hasPlayerRevealedMoves(player2.publicKey) : false;

              if (!p1Submitted || !p2Submitted) {
                matchState = 'waiting_for_moves';
              } else if (!p1Revealed || !p2Revealed) {
                matchState = 'waiting_for_reveals';
              } else {
                matchState = 'completed';
              }
            } else if (gameData.state === 'completed') {
              matchState = 'completed';
            } else {
              matchState = 'ready_to_play';
            }
          } else if (gameData.currentRound + 1 > round) {
            matchState = 'completed';
          }
        }

        // Determine winner
        let winnerId: string | undefined = undefined;
        if (gameData.currentRound + 1 > round && player1 && player2) {
          if (player1.eliminated && !player2.eliminated) {
            winnerId = player2.id;
          } else if (player2.eliminated && !player1.eliminated) {
            winnerId = player1.id;
          }
        }

        // Build player data with all information (pass slot numbers for join button support)
        const player1Data = buildPlayerData(player1, matchState, round, winnerId, player1Slot);
        const player2Data = buildPlayerData(player2, matchState, round, winnerId, player2Slot);

        const isCurrentUserInMatch = !!(currentUserPublicKey && (
          player1?.publicKey === currentUserPublicKey ||
          player2?.publicKey === currentUserPublicKey
        ));

        const matchup: Matchup = {
          player1: player1Data,
          player2: player2Data,
          matchState,
          isCurrentUserInMatch,
          gameId: gameData.id,
          gameState: gameData.state
        };

        roundMatches.push(matchup);
      }

      bracket.push(roundMatches);
    }

    return bracket;
  };

  const bracket = generateBracket();

  // ============================================================================
  // UI Helpers
  // ============================================================================

  const getRoundName = (round: number) => {
    const roundsRemaining = numRounds - round + 1;
    if (roundsRemaining === 1) return 'Finals';
    if (roundsRemaining === 2) return 'Semifinals';
    if (roundsRemaining === 3) return 'Quarterfinals';
    return `Round ${round}`;
  };

  // ============================================================================
  // Scroll Management
  // ============================================================================

  // Auto-scroll to current round on mount and when round changes
  useEffect(() => {
    const currentRoundIndex = gameData.currentRound;
    const roundElement = roundRefs.current[currentRoundIndex];

    if (roundElement && scrollContainerRef.current) {
      setVisibleRoundIndex(currentRoundIndex);
      roundElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [gameData.currentRound]);

  // Detect which round is currently visible when scrolling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      roundRefs.current.forEach((roundElement, index) => {
        if (roundElement) {
          const roundRect = roundElement.getBoundingClientRect();
          const roundCenter = roundRect.left + roundRect.width / 2;
          const distance = Math.abs(roundCenter - containerCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        }
      });

      setVisibleRoundIndex(closestIndex);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [bracket.length]);

  // Navigation functions
  const scrollToRound = (roundIndex: number) => {
    const roundElement = roundRefs.current[roundIndex];
    if (roundElement) {
      roundElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
      setVisibleRoundIndex(roundIndex);
    }
  };

  const scrollToPrevRound = () => {
    if (visibleRoundIndex > 0) {
      scrollToRound(visibleRoundIndex - 1);
    }
  };

  const scrollToNextRound = () => {
    if (visibleRoundIndex < bracket.length - 1) {
      scrollToRound(visibleRoundIndex + 1);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollContainerRef}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: `${theme.spacing.xl} ${theme.spacing.md}`,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth'
        }}
      >
        <div style={{
          display: 'flex',
          gap: theme.spacing['3xl'],
          minWidth: 'min-content',
          minHeight: '70vh',
          alignItems: 'center'
        }}>
          {/* Left spacer to allow first round to center */}
          <div style={{ minWidth: 'calc(50vw - 130px)', flexShrink: 0 }} />

          {bracket.map((roundMatches, roundIndex) => (
            <div
              key={roundIndex}
              ref={(el) => { roundRefs.current[roundIndex] = el; }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: roundIndex === 0 ? '1.5rem' : `${Math.pow(2, roundIndex) * 1.5 + (roundIndex * 2)}rem`,
                minWidth: '260px',
                minHeight: '100%',
                scrollSnapAlign: 'center',
                scrollSnapStop: 'always'
              }}
            >
              {/* Round header */}
              <div style={{
                textAlign: 'center',
                fontWeight: theme.fontWeight.bold,
                fontSize: theme.fontSize.lg,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.md
              }}>
                {getRoundName(roundIndex + 1)}
              </div>

              {/* Matches */}
              {roundMatches.map((matchup, matchIndex) => (
                <MatchupTile
                  key={matchIndex}
                  matchup={matchup}
                  currentUserPublicKey={currentUserPublicKey}
                  isUserInGame={isUserInGame}
                  onMatchupClick={onMatchupClick}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          ))}

          {/* Podium - only show when game is completed */}
          {gameData.state === 'completed' && (() => {
            // Find current user's player data if they were in the game
            const currentUserPlayer = currentUserPublicKey && rawGameData?.players?.find((p: any) =>
              (p.pubkey || p.toString()) === currentUserPublicKey
            );

            // Determine elimination round for current user
            let eliminationRound = null;
            if (currentUserPlayer && currentUserPlayer.eliminated) {
              // Search through bracket history to find when they were eliminated
              for (let round = 0; round < (rawGameData?.bracket?.length || 0); round++) {
                const roundBracket = rawGameData.bracket[round];
                const isInRound = roundBracket.includes(currentUserPlayer.slot);
                const nextRoundBracket = rawGameData.bracket[round + 1];
                const isInNextRound = nextRoundBracket ? nextRoundBracket.includes(currentUserPlayer.slot) : false;

                if (isInRound && !isInNextRound) {
                  eliminationRound = round + 1; // +1 for human-readable round number
                  break;
                }
              }
            }

            // Check if prize has been claimed by comparing actual account balance with prize_pool
            // The program transfers lamports but doesn't update prize_pool field
            const prizePool = rawGameData?.prize_pool || BigInt(0);
            const prizeAmountSOL = Number(prizePool) / 1_000_000_000;

            // If we have the account balance, check if it's significantly lower than prize_pool
            // (indicating lamports were transferred out during claim)
            const prizeClaimed = gameAccountBalance !== undefined
              ? gameAccountBalance < (Number(prizePool) * 0.1) // Balance is less than 10% of original prize
              : false;

            const isUserWinner = currentUserPublicKey === gameData.winner?.publicKey;

            return (
              <div
                ref={(el) => { roundRefs.current[bracket.length] = el; }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minWidth: '260px',
                  minHeight: '100%',
                  scrollSnapAlign: 'center',
                  scrollSnapStop: 'always'
                }}
              >
                {/* Podium header */}
                <div style={{
                  textAlign: 'center',
                  fontWeight: theme.fontWeight.bold,
                  fontSize: theme.fontSize.lg,
                  color: '#ffd700',
                  marginBottom: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.sm
                }}>
                  <Trophy size={24} fill="#ffd700" color="#ffd700" />
                  Podium
                </div>

                {/* Winner card */}
                <div style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.borderRadius.xl,
                  padding: theme.spacing.xl,
                  boxShadow: '0 4px 16px rgba(255, 215, 0, 0.3)',
                  border: '2px solid #ffd700',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: theme.fontSize['2xl'],
                    fontWeight: theme.fontWeight.bold,
                    color: theme.colors.text.primary,
                    marginBottom: theme.spacing.md,
                    wordBreak: 'break-all'
                  }}>
                    {gameData.winner?.nickname || 'Winner'}
                  </div>
                  <div style={{
                    fontSize: theme.fontSize.sm,
                    color: theme.colors.text.secondary,
                    fontFamily: 'monospace',
                    marginBottom: theme.spacing.lg,
                    wordBreak: 'break-all'
                  }}>
                    {gameData.winner?.publicKey ? (
                      `${gameData.winner.publicKey.slice(0, 8)}...${gameData.winner.publicKey.slice(-8)}`
                    ) : 'Unknown'}
                  </div>

                  {/* Current user status messages */}
                  {currentUserPlayer && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      {isUserWinner ? (
                        // User is the winner
                        prizeClaimed ? (
                          // Already claimed
                          <div style={{
                            padding: theme.spacing.lg,
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            borderRadius: theme.borderRadius.md,
                            border: `2px solid ${theme.colors.success}`,
                            color: theme.colors.text.primary
                          }}>
                            <div style={{
                              fontSize: theme.fontSize.lg,
                              fontWeight: theme.fontWeight.bold,
                              marginBottom: theme.spacing.sm
                            }}>
                              🎉 Congratulations!
                            </div>
                            <div style={{ fontSize: theme.fontSize.md }}>
                              You already claimed your winnings of {prizeAmountSOL.toFixed(4)} SOL
                            </div>
                          </div>
                        ) : (
                          // Can claim
                          <button
                            onClick={onClaimPrize}
                            style={{
                              padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                              backgroundColor: '#ffd700',
                              color: '#000',
                              border: 'none',
                              borderRadius: theme.borderRadius.md,
                              cursor: 'pointer',
                              fontSize: theme.fontSize.lg,
                              fontWeight: theme.fontWeight.bold,
                              width: '100%',
                              transition: theme.transition.base
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffed4e';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffd700';
                            }}
                          >
                            Claim Prize ({prizeAmountSOL.toFixed(4)} SOL)
                          </button>
                        )
                      ) : eliminationRound ? (
                        // User was eliminated
                        <div style={{
                          padding: theme.spacing.lg,
                          backgroundColor: 'rgba(255, 152, 0, 0.1)',
                          borderRadius: theme.borderRadius.md,
                          border: `2px solid ${theme.colors.warning}`,
                          color: theme.colors.text.secondary,
                          fontSize: theme.fontSize.md
                        }}>
                          You were eliminated in Round {eliminationRound}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Right spacer to allow last round to center */}
          <div style={{ minWidth: 'calc(50vw - 130px)', flexShrink: 0 }} />
        </div>
      </div>

      {/* Navigation Buttons */}
      {visibleRoundIndex > 0 && (
        <button
          onClick={scrollToPrevRound}
          className="bracket-nav-left"
          style={{
            position: 'fixed',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `2px solid ${theme.colors.primary.main}`,
            backgroundColor: theme.colors.surface,
            color: theme.colors.primary.main,
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary.main;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surface;
            e.currentTarget.style.color = theme.colors.primary.main;
          }}
        >
          ←
        </button>
      )}

      {visibleRoundIndex < bracket.length - 1 && (
        <button
          onClick={scrollToNextRound}
          style={{
            position: 'fixed',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `2px solid ${theme.colors.primary.main}`,
            backgroundColor: theme.colors.surface,
            color: theme.colors.primary.main,
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary.main;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surface;
            e.currentTarget.style.color = theme.colors.primary.main;
          }}
        >
          →
        </button>
      )}
    </div>
  );
}
