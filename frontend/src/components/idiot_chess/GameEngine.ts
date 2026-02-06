
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
  winner: Player | null;
  history: string[]; // For debugging mainly
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
        // Deep copy needed to ensure unique objects if we restarted (though IDs are hardcoded for initial board)
        // Ideally we should regenerate IDs on reset, but hardcoded is fine for initial setup as long as they are unique.
        board: JSON.parse(JSON.stringify(INITIAL_BOARD)),
        turn: 'white',
        winner: null,
        history: [],
      };
    }
  }

  public getState(): GameState {
    return this.state;
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
      // Pawn Logic
      const direction = piece.player === 'white' ? 1 : -1;

      // Move Forward
      const fwd = { x: pos.x, y: pos.y + direction };
      if (this.isValidPos(fwd) && !this.getPiece(fwd)) {
        moves.push(fwd);
      }

      // Capture Diagonally
      const captures = [[-1, direction], [1, direction]];
      for (const [dx, dy] of captures) {
        const capPos = { x: pos.x + dx, y: pos.y + dy };
        if (this.isValidPos(capPos)) {
          const target = this.getPiece(capPos);
          if (target && target.player !== piece.player) {
            moves.push(capPos);
          }
        }
      }
    }

    return moves;
  }

  public move(from: Position, to: Position): boolean {
    const validMoves = this.getValidMoves(from);
    if (!validMoves.some(m => m.x === to.x && m.y === to.y)) return false;

    const piece = this.getPiece(from)!;

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

    // Check Win Conditions
    this.checkWinCondition();

    // Switch turn if no winner
    if (!this.state.winner) {
      this.state.turn = this.state.turn === 'white' ? 'black' : 'white';
    }

    this.state.history.push(`${piece.player} ${piece.type} ${from.x},${from.y} -> ${to.x},${to.y}`);

    return true;
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

    // 2. King reaches opponent's starting square
    // White King starts at (2,0), needs to reach (2,4)
    // Black King starts at (2,4), needs to reach (2,0)
    const goalWhite = { x: 2, y: 4 };
    const goalBlack = { x: 2, y: 0 };

    const pieceAtWhiteGoal = this.getPiece(goalWhite);
    if (pieceAtWhiteGoal && pieceAtWhiteGoal.player === 'white' && pieceAtWhiteGoal.type === 'king') {
      this.state.winner = 'white';
      return;
    }

    const pieceAtBlackGoal = this.getPiece(goalBlack);
    if (pieceAtBlackGoal && pieceAtBlackGoal.player === 'black' && pieceAtBlackGoal.type === 'king') {
      this.state.winner = 'black';
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
  public makeRandomMove(): boolean {
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
  }
}
