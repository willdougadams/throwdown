import React, { useRef, useEffect, useState } from 'react';
import { Circle, FileText, Scissors, X, ChevronLeft, ChevronRight, Zap, Wind, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type Move = 'rock' | 'paper' | 'scissors' | 'fury' | 'serenity' | 'trickery';

interface MoveSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: 'waiting' | 'in_progress' | 'completed';
  hasUserSubmittedMoves: boolean;
  hasUserRevealedMoves: boolean;
  hasOpponentSubmittedMoves: boolean;
  selectedMoves: Move[];
  moveSalt: bigint | null;
  onMoveSelect: (index: number, move: Move) => void;
  onSubmitMoves: () => void;
  onRevealMoves: () => void;
}

export function MoveSubmissionModal({
  isOpen,
  onClose,
  gameState,
  hasUserSubmittedMoves,
  hasUserRevealedMoves,
  hasOpponentSubmittedMoves,
  selectedMoves,
  moveSalt,
  onMoveSelect,
  onSubmitMoves,
  onRevealMoves
}: MoveSubmissionModalProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const moveRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  // Reset to first move when modal opens
  useEffect(() => {
    if (isOpen && gameState === 'in_progress' && !hasUserSubmittedMoves) {
      setCurrentMoveIndex(0);
      // Scroll to first move after a brief delay to ensure render
      setTimeout(() => {
        if (moveRefs.current[0]) {
          moveRefs.current[0].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 100);
    }
  }, [isOpen, gameState, hasUserSubmittedMoves]);

  // Auto-scroll to next move when a move is selected
  const handleMoveSelectWithScroll = (index: number, move: Move) => {
    onMoveSelect(index, move);

    // If not the last move, scroll to next
    if (index < 4) {
      setTimeout(() => {
        const nextIndex = index + 1;
        setCurrentMoveIndex(nextIndex);
        if (moveRefs.current[nextIndex]) {
          moveRefs.current[nextIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 300);
    } else {
      // Last move selected, scroll to submit button
      setTimeout(() => {
        setCurrentMoveIndex(5); // 5 represents the submit section
        if (moveRefs.current[5]) {
          moveRefs.current[5].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 300);
    }
  };

  const scrollToMove = (index: number) => {
    setCurrentMoveIndex(index);
    if (moveRefs.current[index]) {
      moveRefs.current[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.text.secondary,
            padding: '0.5rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={24} />
        </button>

        {/* Submit Moves - Horizontal Scroll */}
        {gameState === 'in_progress' && !hasUserSubmittedMoves && (
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Progress indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  onClick={() => i < 5 ? scrollToMove(i) : scrollToMove(5)}
                  style={{
                    width: i === 5 ? '40px' : '12px',
                    height: '12px',
                    borderRadius: '6px',
                    backgroundColor: currentMoveIndex === i
                      ? theme.colors.primary.main
                      : (i < 5 && selectedMoves[i])
                        ? theme.colors.success
                        : theme.colors.border,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                />
              ))}
            </div>

            {/* Scroll container */}
            <div
              ref={scrollContainerRef}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollBehavior: 'smooth',
                gap: '2rem',
                padding: '1rem 0',
                marginBottom: '1rem',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {/* Spacer for centering */}
              <div style={{ minWidth: 'calc(50% - 200px)', flexShrink: 0 }} />

              {/* Move selection pages */}
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  ref={(el) => { moveRefs.current[index] = el; }}
                  style={{
                    minWidth: '400px',
                    maxWidth: '400px',
                    flexShrink: 0,
                    scrollSnapAlign: 'center',
                    scrollSnapStop: 'always',
                    textAlign: 'center'
                  }}
                >
                  <h3 style={{
                    color: theme.colors.text.primary,
                    marginBottom: '1rem',
                    fontSize: theme.fontSize['2xl'],
                    fontWeight: theme.fontWeight.bold
                  }}>
                    {t('rps.game.move_n', { n: index + 1 })}
                  </h3>
                  <p style={{
                    color: theme.colors.text.secondary,
                    marginBottom: '2rem',
                    fontSize: theme.fontSize.sm
                  }}>
                    {selectedMoves[index]
                      ? t('rps.game.selected_move', { move: t(`rps.game.moves.${selectedMoves[index]}`) })
                      : t('rps.game.choose_move')}
                  </p>

                  {/* Basic Moves */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {(['rock', 'paper', 'scissors'] as const).map((move) => {
                      const Icon = move === 'rock' ? Circle : move === 'paper' ? FileText : Scissors;
                      const isSelected = selectedMoves[index] === move;
                      return (
                        <button
                          key={`${index}-${move}`}
                          onClick={() => handleMoveSelectWithScroll(index, move as Move)}
                          style={{
                            aspectRatio: '1',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            backgroundColor: isSelected ? '#2196F3' : theme.colors.tertiary,
                            color: isSelected ? 'white' : theme.colors.text.primary,
                            border: `3px solid ${isSelected ? '#2196F3' : theme.colors.border}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: theme.fontSize.sm,
                            fontWeight: theme.fontWeight.bold,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Icon size={32} fill={move === 'rock' ? 'currentColor' : 'none'} />
                          <span style={{ textTransform: 'capitalize' }}>{t(`rps.game.moves.${move}`)}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Strategies - only available after first move */}
                  <div style={{
                    marginTop: '1.5rem',
                    opacity: index === 0 ? 0.4 : 1,
                    pointerEvents: index === 0 ? 'none' : 'auto'
                  }}>
                    <p style={{
                      color: theme.colors.text.secondary,
                      fontSize: '0.8rem',
                      marginBottom: '0.8rem',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {t('rps.game.strategies_label', { defaultValue: 'Strategies' })}
                      {index === 0 && ` (${t('rps.game.unavailable_round1', { defaultValue: 'Unavailable Round 1' })})`}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      {(['fury', 'serenity', 'trickery'] as const).map((strategy) => {
                        const Icon = strategy === 'fury' ? Zap : strategy === 'serenity' ? Wind : Sparkles;
                        const isSelected = selectedMoves[index] === strategy;
                        return (
                          <button
                            key={`${index}-${strategy}`}
                            onClick={() => handleMoveSelectWithScroll(index, strategy as Move)}
                            style={{
                              aspectRatio: '1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              backgroundColor: isSelected ? '#9c27b0' : theme.colors.tertiary,
                              color: isSelected ? 'white' : theme.colors.text.primary,
                              border: `3px solid ${isSelected ? '#9c27b0' : theme.colors.border}`,
                              borderRadius: '12px',
                              cursor: 'pointer',
                              fontSize: theme.fontSize.sm,
                              fontWeight: theme.fontWeight.bold,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Icon size={32} fill={strategy === 'fury' ? 'currentColor' : 'none'} />
                            <span style={{ textTransform: 'capitalize' }}>{t(`rps.game.moves.${strategy}`)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Submit page */}
              <div
                ref={(el) => { moveRefs.current[5] = el; }}
                style={{
                  minWidth: '400px',
                  maxWidth: '400px',
                  flexShrink: 0,
                  scrollSnapAlign: 'center',
                  scrollSnapStop: 'always',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '1.5rem'
                }}
              >
                <h3 style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.fontSize['2xl'],
                  fontWeight: theme.fontWeight.bold
                }}>
                  {selectedMoves.length === 5 ? t('rps.game.ready_submit') : t('rps.game.select_all_prompt')}
                </h3>
                <p style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.fontSize.md
                }}>
                  {selectedMoves.length === 5
                    ? t('rps.game.hidden_note')
                    : t('rps.game.moves_selected_count', { count: selectedMoves.length })}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      onSubmitMoves();
                      onClose();
                    }}
                    disabled={selectedMoves.length !== 5}
                    style={{
                      padding: '1.5rem 2rem',
                      backgroundColor: selectedMoves.length === 5 ? '#28a745' : '#999',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: selectedMoves.length === 5 ? 'pointer' : 'not-allowed',
                      fontSize: theme.fontSize.xl,
                      fontWeight: theme.fontWeight.bold,
                      opacity: selectedMoves.length === 5 ? 1 : 0.6
                    }}
                  >
                    {t('rps.game.submit_moves_btn', { count: selectedMoves.length })}
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '1rem 2rem',
                      backgroundColor: 'transparent',
                      color: theme.colors.text.secondary,
                      border: `2px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: theme.fontSize.md,
                      fontWeight: theme.fontWeight.semibold
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>

              {/* Spacer for centering */}
              <div style={{ minWidth: 'calc(50% - 200px)', flexShrink: 0 }} />
            </div>

            {/* Navigation arrows */}
            {currentMoveIndex > 0 && (
              <button
                onClick={() => scrollToMove(Math.max(0, currentMoveIndex - 1))}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: `2px solid ${theme.colors.primary.main}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.primary.main,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {currentMoveIndex < 5 && (
              <button
                onClick={() => scrollToMove(Math.min(5, currentMoveIndex + 1))}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: `2px solid ${theme.colors.primary.main}`,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.primary.main,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  transition: 'all 0.2s'
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        )}

        {/* Reveal Moves */}
        {gameState === 'in_progress' && hasUserSubmittedMoves && !hasUserRevealedMoves && (
          <div>
            <h2 style={{ color: theme.colors.text.primary, marginBottom: '1.5rem', textAlign: 'center' }}>
              {hasOpponentSubmittedMoves ? t('rps.game.reveal_title') : t('rps.game.waiting_opponent_title')}
            </h2>

            {(selectedMoves.length !== 5 || !moveSalt) ? (
              <div style={{
                padding: '2rem',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                borderRadius: '12px',
                border: `2px solid ${theme.colors.error}`,
                textAlign: 'center',
                marginBottom: '2rem'
              }}>
                <p style={{ color: theme.colors.error, fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {t('rps.game.moves_not_found')}
                </p>
                <p style={{ color: theme.colors.text.secondary, fontSize: '0.9rem' }}>
                  {t('rps.game.moves_not_found_desc')}
                </p>
                <p style={{ color: theme.colors.text.secondary, fontSize: '0.9rem', marginTop: '1rem' }}>
                  {t('rps.game.moves_not_found_note')}
                </p>
              </div>
            ) : (
              <>
                <p style={{ color: theme.colors.text.secondary, marginBottom: '2rem', textAlign: 'center' }}>
                  {hasOpponentSubmittedMoves
                    ? t('rps.game.reveal_desc')
                    : t('rps.game.reveal_wait_desc')}
                </p>

                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  {selectedMoves.map((move, index) => {
                    const Icon = move === 'rock' ? Circle :
                      move === 'paper' ? FileText :
                        move === 'scissors' ? Scissors :
                          move === 'fury' ? Zap :
                            move === 'serenity' ? Wind :
                              Sparkles;
                    return (
                      <div key={index} style={{ textAlign: 'center' }}>
                        <div style={{
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'center',
                          color: move === 'fury' || move === 'serenity' || move === 'trickery' ? '#9c27b0' : theme.colors.text.primary
                        }}>
                          <Icon size={48} fill={(move === 'rock' || move === 'fury') ? 'currentColor' : 'none'} />
                        </div>
                        <div style={{
                          fontSize: '0.9rem',
                          color: theme.colors.text.secondary
                        }}>
                          {t(`rps.game.moves.${move}`)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                {t('common.cancel')}
              </button>
              {selectedMoves.length === 5 && moveSalt && (
                <button
                  onClick={() => {
                    onRevealMoves();
                    onClose();
                  }}
                  disabled={!hasOpponentSubmittedMoves}
                  style={{
                    padding: '1rem 2rem',
                    backgroundColor: hasOpponentSubmittedMoves ? '#9c27b0' : '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: hasOpponentSubmittedMoves ? 'pointer' : 'not-allowed',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    opacity: hasOpponentSubmittedMoves ? 1 : 0.6
                  }}
                >
                  {hasOpponentSubmittedMoves ? t('rps.game.reveal_title') : t('rps.game.waiting_opponent_title')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Already submitted/revealed */}
        {gameState === 'in_progress' && (
          (hasUserSubmittedMoves && !hasUserRevealedMoves && (!selectedMoves.length || !moveSalt)) ||
          hasUserRevealedMoves
        ) && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <h2 style={{ color: theme.colors.success, marginBottom: '1rem' }}>{t('rps.game.all_set')}</h2>
              <p style={{ color: theme.colors.text.secondary }}>
                {!hasUserRevealedMoves
                  ? t('rps.game.waiting_opponent_submit')
                  : t('rps.game.waiting_matchup_resolve')}
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
