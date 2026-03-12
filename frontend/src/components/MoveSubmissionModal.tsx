import { useRef, useEffect, useState } from 'react';
import { Circle, FileText, Scissors, X, ChevronLeft, ChevronRight, Zap, Wind, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { StrategySidebar } from './StrategySidebar';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1000);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          maxWidth: '1200px', // Increased to accommodate sidebar
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

        {/* Submit Moves Section */}
        {gameState === 'in_progress' && !hasUserSubmittedMoves && (
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '2rem'
          }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
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
                    ref={el => { moveRefs.current[index] = el; }}
                    style={{
                      minWidth: '320px',
                      width: '400px',
                      flexShrink: 0,
                      scrollSnapAlign: 'center',
                      padding: '1rem',
                      backgroundColor: theme.colors.surface,
                      borderRadius: '12px',
                      border: `2px solid ${currentMoveIndex === index ? theme.colors.primary.main : theme.colors.border}`,
                      transition: 'all 0.3s'
                    }}
                  >
                    <h3 style={{ color: theme.colors.text.primary, textAlign: 'center', marginBottom: '1.5rem' }}>
                      {t('rps.game.select_move_number', { number: index + 1 })}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      {(['rock', 'paper', 'scissors'] as const).map((m) => {
                        const Icon = m === 'rock' ? Circle : m === 'paper' ? FileText : Scissors;
                        const isSelected = selectedMoves[index] === m;
                        return (
                          <button
                            key={m}
                            onClick={() => handleMoveSelectWithScroll(index, m)}
                            style={{
                              aspectRatio: '1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              borderRadius: '12px',
                              border: `2px solid ${isSelected ? theme.colors.primary.main : theme.colors.border}`,
                              backgroundColor: isSelected ? 'rgba(33, 150, 243, 0.1)' : theme.colors.surface,
                              color: isSelected ? theme.colors.primary.main : theme.colors.text.primary,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              padding: '0.5rem'
                            }}
                          >
                            <Icon size={32} fill={m === 'rock' ? 'currentColor' : 'none'} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`rps.game.moves.${m}`)}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      opacity: index === 0 ? 0.4 : 1,
                      pointerEvents: index === 0 ? 'none' : 'auto'
                    }}>
                      {(['fury', 'serenity', 'trickery'] as const).map((s) => {
                        const Icon = s === 'fury' ? Zap : s === 'serenity' ? Wind : Sparkles;
                        const isSelected = selectedMoves[index] === s;
                        return (
                          <button
                            key={s}
                            onClick={() => handleMoveSelectWithScroll(index, s)}
                            style={{
                              aspectRatio: '1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              borderRadius: '12px',
                              border: `2px solid ${isSelected ? '#9c27b0' : theme.colors.border}`,
                              backgroundColor: isSelected ? 'rgba(156, 39, 176, 0.1)' : theme.colors.surface,
                              color: isSelected ? '#9c27b0' : theme.colors.text.primary,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              padding: '0.5rem'
                            }}
                          >
                            <Icon size={32} fill={s === 'fury' ? 'currentColor' : 'none'} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`rps.game.moves.${s}`)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {index === 0 && (
                      <p style={{
                        marginTop: '1rem',
                        fontSize: '0.75rem',
                        color: theme.colors.text.secondary,
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        {t('rps.game.strategies_unavailable')}
                      </p>
                    )}
                  </div>
                ))}

                {/* Final Submit Page */}
                <div
                  ref={el => { moveRefs.current[5] = el; }}
                  style={{
                    minWidth: '320px',
                    width: '400px',
                    flexShrink: 0,
                    scrollSnapAlign: 'center',
                    padding: '2rem',
                    backgroundColor: theme.colors.surface,
                    borderRadius: '12px',
                    border: `2px solid ${currentMoveIndex === 5 ? theme.colors.success : theme.colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.5rem'
                  }}
                >
                  <h3 style={{ color: theme.colors.text.primary }}>{t('rps.game.ready_to_submit')}</h3>
                  <p style={{ color: theme.colors.text.secondary, textAlign: 'center' }}>
                    {selectedMoves.length === 5
                      ? t('rps.game.all_moves_selected')
                      : t('rps.game.moves_missing')}
                  </p>

                  <button
                    onClick={() => {
                      onSubmitMoves();
                      onClose();
                    }}
                    disabled={selectedMoves.length < 5}
                    style={{
                      padding: '1rem 2rem',
                      backgroundColor: theme.colors.success,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: selectedMoves.length === 5 ? 'pointer' : 'not-allowed',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      opacity: selectedMoves.length === 5 ? 1 : 0.6,
                      width: '100%'
                    }}
                  >
                    {t('rps.game.submit_moves_btn')}
                  </button>
                </div>

                {/* Spacer for centering */}
                <div style={{ minWidth: 'calc(50% - 200px)', flexShrink: 0 }} />
              </div>

              {/* Navigation Arrows */}
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

            <StrategySidebar isMobile={isMobile} />
          </div>
        )}

        {/* Reveal Moves Section */}
        {gameState === 'in_progress' && hasUserSubmittedMoves && !hasUserRevealedMoves && (
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '2rem'
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
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

            <StrategySidebar isMobile={isMobile} />
          </div>
        )}

        {/* Status Messaging Section */}
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
