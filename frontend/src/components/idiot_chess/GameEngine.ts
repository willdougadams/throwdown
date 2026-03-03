
export type Player = 'white' | 'black';
export type PieceType = 'king' | 'pawn';

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  id: string; // Unique ID for animation tracking
  type: PieceType;
  player: Player;
}

export interface GameState {
  board: (Piece | null)[][]; // 5x5 grid
  turn: Player;
  winner: Player | 'draw' | null;
  history: string[];
  moveCount: number;
  whiteTimeSeconds: number;
  blackTimeSeconds: number;
}

export const BOARD_SIZE = 5;

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const INITIAL_BOARD: (Piece | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

// Setup initial positions
// White (Bottom, y=0,1)
// King at (2, 0)
// Pawns at (0,0), (1,0), (3,0), (4,0), (2,1)
INITIAL_BOARD[0][2] = { id: 'w-king', type: 'king', player: 'white' };
INITIAL_BOARD[0][0] = { id: 'w-p1', type: 'pawn', player: 'white' };
INITIAL_BOARD[0][1] = { id: 'w-p2', type: 'pawn', player: 'white' };
INITIAL_BOARD[0][3] = { id: 'w-p3', type: 'pawn', player: 'white' };
INITIAL_BOARD[0][4] = { id: 'w-p4', type: 'pawn', player: 'white' };
INITIAL_BOARD[1][2] = { id: 'w-p5', type: 'pawn', player: 'white' };

// Black (Top, y=4,3)
// King at (2, 4)
// Pawns at (0,4), (1,4), (3,4), (4,4), (2,3)
INITIAL_BOARD[4][2] = { id: 'b-king', type: 'king', player: 'black' };
INITIAL_BOARD[4][0] = { id: 'b-p1', type: 'pawn', player: 'black' };
INITIAL_BOARD[4][1] = { id: 'b-p2', type: 'pawn', player: 'black' };
INITIAL_BOARD[4][3] = { id: 'b-p3', type: 'pawn', player: 'black' };
INITIAL_BOARD[4][4] = { id: 'b-p4', type: 'pawn', player: 'black' };
INITIAL_BOARD[3][2] = { id: 'b-p5', type: 'pawn', player: 'black' };

export class IdiotChessEngine {
  private state: GameState;

  constructor(initialState?: GameState) {
    if (initialState) {
      this.state = JSON.parse(JSON.stringify(initialState));
    } else {
      this.state = {
        board: JSON.parse(JSON.stringify(INITIAL_BOARD)),
        turn: 'white',
        winner: null,
        history: [],
        moveCount: 0,
        whiteTimeSeconds: 600,
        blackTimeSeconds: 600
      };
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public forceSetState(newState: Partial<GameState>): void {
    this.state = { ...this.state, ...newState };
  }

  public getPiece(pos: Position): Piece | null {
    if (!this.isValidPos(pos)) return null;
    return this.state.board[pos.y][pos.x];
  }

  public isValidPos(pos: Position): boolean {
    return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
  }

  public getValidMoves(pos: Position): Position[] {
    const piece = this.getPiece(pos);
    if (!piece || piece.player !== this.state.turn || this.state.winner) return [];

    const moves: Position[] = [];
    const directions = piece.type === 'king'
      ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
      : piece.player === 'white' ? [[0, 1], [-1, 1], [1, 1]] : [[0, -1], [-1, -1], [1, -1]];

    if (piece.type === 'king') {
      for (const [dx, dy] of directions) {
        const newPos = { x: pos.x + dx, y: pos.y + dy };
        if (this.isValidPos(newPos)) {
          const target = this.getPiece(newPos);
          if (!target || target.player !== piece.player) {
            moves.push(newPos);
          }
        }
      }
    } else {
      // Pawn Logic - Refined
      // Move: Forward, Diag-Left, Diag-Right (to empty squares)
      // Capture: Diag-Left, Diag-Right (ONLY)

      const direction = piece.player === 'white' ? 1 : -1;
      const movesToCheck = [
        { x: pos.x - 1, y: pos.y + direction, isDiag: true }, // Forward-Left
        { x: pos.x, y: pos.y + direction, isDiag: false }, // Forward
        { x: pos.x + 1, y: pos.y + direction, isDiag: true }  // Forward-Right
      ];

      for (const { x, y, isDiag } of movesToCheck) {
        const move = { x, y };
        if (this.isValidPos(move)) {
          const target = this.getPiece(move);
          if (!target) {
            // Empty square: Valid move (for all 3 directions)
            moves.push(move);
          } else if (isDiag && target.player !== piece.player) {
            // Enemy piece: Valid capture (ONLY for diagonals)
            moves.push(move);
          }
          // Friendly piece or Forward Capture: Blocked
        }
      }
    }

    return moves;
  }

  public move(from: Position, to: Position): boolean {
    const validMoves = this.getValidMoves(from);
    if (!validMoves.some(m => m.x === to.x && m.y === to.y)) return false;

    const piece = this.getPiece(from)!;
    const targetPiece = this.getPiece(to);
    const opponent = piece.player === 'white' ? 'black' : 'white';

    // Execute move
    this.state.board[to.y][to.x] = piece;
    this.state.board[from.y][from.x] = null;

    // Promotion
    if (piece.type === 'pawn') {
      if ((piece.player === 'white' && to.y === BOARD_SIZE - 1) ||
        (piece.player === 'black' && to.y === 0)) {
        piece.type = 'king';
      }
    }

    // Last Stand Logic: If we captured a piece, check if opponent has only King left
    if (targetPiece) {
      const opponentPieces = this.countPieces(opponent);
      if (opponentPieces === 1) { // Only King remaining
        this.spawnLastStandPawn(opponent);
      }
      this.state.moveCount = 0; // Reset move count on capture
    } else {
      this.state.moveCount++; // Increment move count for draw detection
    }

    // Check Win Conditions
    this.checkWinCondition();

    // Check for draw (e.g., 15 moves without capture)
    if (!this.state.winner && this.state.moveCount >= 15) {
      this.state.winner = 'draw';
    }

    // Switch turn if no winner
    if (!this.state.winner) {
      this.state.turn = this.state.turn === 'white' ? 'black' : 'white';
    }

    this.state.history.push(`${piece.player} ${piece.type} ${from.x},${from.y} -> ${to.x},${to.y}`);

    return true;
  }

  public tick(seconds: number = 1): void {
    if (this.state.winner) return;

    if (this.state.turn === 'white') {
      this.state.whiteTimeSeconds = Math.max(0, this.state.whiteTimeSeconds - seconds);
      if (this.state.whiteTimeSeconds === 0) {
        this.state.winner = 'black';
      }
    } else {
      this.state.blackTimeSeconds = Math.max(0, this.state.blackTimeSeconds - seconds);
      if (this.state.blackTimeSeconds === 0) {
        this.state.winner = 'white';
      }
    }
  }

  private checkWinCondition() {
    // 1. All opponent kings captured
    const whiteKings = this.countKings('white');
    const blackKings = this.countKings('black');

    if (whiteKings === 0) {
      this.state.winner = 'black';
      return;
    }
    if (blackKings === 0) {
      this.state.winner = 'white';
      return;
    }
  }

  private countKings(player: Player): number {
    let count = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const piece = this.state.board[y][x];
        if (piece && piece.player === player && piece.type === 'king') {
          count++;
        }
      }
    }
    return count;
  }

  private countPieces(player: Player): number {
    let count = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const piece = this.state.board[y][x];
        if (piece && piece.player === player) {
          count++;
        }
      }
    }
    return count;
  }

  private spawnLastStandPawn(player: Player) {
    // Attempt to spawn at King's start: White (2,0), Black (2,4)
    const startX = 2;
    const startY = player === 'white' ? 0 : 4;

    // Spiral search for empty spot if taken
    // Radius 0 to BOARD_SIZE
    // Actually just simple BFS or linear scan near start is fine for 5x5
    // Let's do a simple check of the start square and then neighbors

    const potentialSpots: Position[] = [{ x: startX, y: startY }];

    // Add neighbors (and their neighbors) in order of preference (closest to base)
    for (let r = 1; r < BOARD_SIZE; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          // Only check edge of radius r
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

          const x = startX + dx;
          const y = startY + dy;
          if (this.isValidPos({ x, y })) {
            potentialSpots.push({ x, y });
          }
        }
      }
    }

    for (const pos of potentialSpots) {
      if (!this.getPiece(pos)) {
        // Found empty spot!
        this.state.board[pos.y][pos.x] = {
          id: `${player}-last-stand-${Date.now()}`,
          type: 'pawn',
          player: player
        };
        this.state.history.push(`${player} LAST STAND! Spawning pawn at ${pos.x},${pos.y}`);
        return;
      }
    }
  }

  private evaluateBoard(): number {
    // Large values for winning/losing
    const WIN_SCORE = 100000;
    if (this.state.winner === 'white') return WIN_SCORE;
    if (this.state.winner === 'black') return -WIN_SCORE;

    let score = 0;
    const KING_VAL = 1000;
    const PAWN_VAL = 100;

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const piece = this.state.board[y][x];
        if (!piece) continue;

        let pieceVal = 0;
        // Material score
        if (piece.type === 'king') pieceVal += KING_VAL;
        else if (piece.type === 'pawn') pieceVal += PAWN_VAL;

        // Positional score: Encourage advancing
        // White starts at y=0/1, wants to go up (y+) ??
        // Check Setup:
        // White (Bottom, y=0,1). King at (2,0). Goal (2,4).
        // Black (Top, y=4,3). King at (2,4). Goal (2,0).
        if (piece.player === 'white') {
          // White wants higher Y
          pieceVal += y * 10;
          score += pieceVal;
        } else {
          // Black wants lower Y
          pieceVal += (4 - y) * 10;
          score -= pieceVal;
        }
      }
    }
    return score;
  }

  private getAllAvailableMoves(player: Player): { from: Position, to: Position }[] {
    const moves: { from: Position, to: Position }[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const piece = this.state.board[y][x];
        if (piece && piece.player === player) {
          const from = { x, y };
          const validMoves = this.getValidMoves(from);
          for (const to of validMoves) {
            moves.push({ from, to });
          }
        }
      }
    }
    return moves;
  }

  private minimax(depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0 || this.state.winner) {
      return this.evaluateBoard();
    }

    const player = isMaximizing ? 'white' : 'black';
    const moves = this.getAllAvailableMoves(player);

    if (moves.length === 0) {
      // Stalemate check or just no moves?
      // If no moves and no winner, likely stalemate (draw).
      // For now return current eval.
      return this.evaluateBoard();
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const savedState = JSON.stringify(this.state);
        this.move(move.from, move.to);
        const evalVal = this.minimax(depth - 1, alpha, beta, false);
        this.state = JSON.parse(savedState);

        maxEval = Math.max(maxEval, evalVal);
        alpha = Math.max(alpha, evalVal);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const savedState = JSON.stringify(this.state);
        this.move(move.from, move.to);
        const evalVal = this.minimax(depth - 1, alpha, beta, true);
        this.state = JSON.parse(savedState);

        minEval = Math.min(minEval, evalVal);
        beta = Math.min(beta, evalVal);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  public makeSmartMove(depth: number = 3): boolean {
    if (this.state.winner) return false;

    // Figure out who is moving
    const player = this.state.turn;
    const isMaximizing = player === 'white';
    const moves = this.getAllAvailableMoves(player);

    if (moves.length === 0) return false;

    // Shuffle moves so we don't always pick the first best one (variety in opening)
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }

    let bestMove = moves[0];
    let bestValue = isMaximizing ? -Infinity : Infinity;

    // If there is a winning move right now, take it! (optimization)
    // Actually minimax depth 1 captures this, but full depth is safer.

    for (const move of moves) {
      const savedState = JSON.stringify(this.state);
      this.move(move.from, move.to);
      // Next is opponent turn
      const boardValue = this.minimax(depth - 1, -Infinity, Infinity, !isMaximizing);
      this.state = JSON.parse(savedState);

      if (isMaximizing) {
        if (boardValue > bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      } else {
        if (boardValue < bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      }
    }

    if (bestMove) {
      this.move(bestMove.from, bestMove.to);
      return true;
    }
    return false;
  }

  public makeRandomMove(): boolean {
    // Fallback or legacy support
    return this.makeSmartMove(1); // Smart move with depth 1 is basically "don't die immediately" or nice greedy
    /*
    if (this.state.winner) return false;

    const myPieces: Position[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const piece = this.state.board[y][x];
        if (piece && piece.player === this.state.turn) {
          myPieces.push({ x, y });
        }
      }
    }

    // Shuffle pieces to ensure randomness at the piece selection level too
    for (let i = myPieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [myPieces[i], myPieces[j]] = [myPieces[j], myPieces[i]];
    }

    for (const from of myPieces) {
      const validMoves = this.getValidMoves(from);
      if (validMoves.length > 0) {
        // Pick a random move for this piece
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        this.move(from, randomMove);
        return true;
      }
    }

    return false;
    */
  }
}
