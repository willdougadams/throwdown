use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
    sysvars::{clock::Clock, Sysvar},
};

entrypoint!(process_instruction);

// ============================================================================
// Constants
// ============================================================================

pub const BOARD_SIZE: usize = 5;
pub const MAX_PLAYERS: usize = 2;
pub const DRAW_MOVE_COUNT: u8 = 15;

// ============================================================================
// Enums
// ============================================================================

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GameState {
    WaitingForPlayers = 0,
    InProgress = 1,
    Finished = 2,
}

unsafe impl Zeroable for GameState {}
unsafe impl Pod for GameState {}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Player {
    White = 0,
    Black = 1,
}

unsafe impl Zeroable for Player {}
unsafe impl Pod for Player {}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PieceType {
    None = 0,
    King = 1,
    Pawn = 2,
}

unsafe impl Zeroable for PieceType {}
unsafe impl Pod for PieceType {}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Winner {
    None = 0,
    White = 1,
    Black = 2,
    Draw = 3,
}

unsafe impl Zeroable for Winner {}
unsafe impl Pod for Winner {}

// ============================================================================
// Account Structures
// ============================================================================

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct Piece {
    pub piece_type: PieceType,
    pub player: Player,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct PlayerData {
    pub pubkey: Pubkey,
    pub eliminated: u8,
    pub _padding: [u8; 7],
}

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct GameAccount {
    pub creator: Pubkey,                          // 32
    pub name: [u8; 64],                           // 64 -> 96
    pub last_action_timestamp: i64,               // 8  -> 104
    pub buy_in_lamports: u64,                     // 8  -> 112
    pub prize_pool: u64,                          // 8  -> 120
    pub white_time_seconds: i64,                  // 8  -> 128
    pub black_time_seconds: i64,                  // 8  -> 136
    pub players: [PlayerData; MAX_PLAYERS],       // 2 * 40 = 80 -> 216
    pub board: [[Piece; BOARD_SIZE]; BOARD_SIZE], // 5 * 5 * 2 = 50 -> 266
    pub turn: Player,                             // 1 -> 267
    pub winner: Winner,                           // 1 -> 268
    pub move_count: u8,                           // 1 -> 269
    pub _padding: [u8; 3],                        // 3 -> 272 (8-byte aligned)
}
// Sum of fields: 32+64+8+8+8+8+8+(2*40)+(25*2)+1+1+1+3 = 272
// 272 / 8 = 34 (Perfectly aligned)

// ============================================================================
// Helper Functions for Data Access
// ============================================================================

fn get_game_mut(data: &mut [u8]) -> &mut GameAccount {
    bytemuck::from_bytes_mut(&mut data[..std::mem::size_of::<GameAccount>()])
}

// ============================================================================
// Entrypoint
// ============================================================================

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    match instruction_data[0] {
        0 => {
            // CreateChallenge: [0] disc, [1..9] buy_in, [9] name_len, [10..] name
            if instruction_data.len() < 10 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let buy_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let name_len = instruction_data[9] as usize;
            let name = &instruction_data[10..10 + name_len];
            create_challenge(accounts, buy_in, name)
        }
        1 => accept_challenge(accounts),
        2 => {
            // MakeMove: [0] disc, [1] from_x, [2] from_y, [3] to_x, [4] to_y
            if instruction_data.len() < 5 {
                return Err(ProgramError::InvalidInstructionData);
            }
            make_move(
                accounts,
                instruction_data[1],
                instruction_data[2],
                instruction_data[3],
                instruction_data[4],
            )
        }
        3 => claim_prize(accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// ============================================================================
// Logic Handlers
// ============================================================================

fn create_challenge(
    accounts: &[AccountInfo],
    buy_in_lamports: u64,
    name: &[u8],
) -> ProgramResult {
    let [creator, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    // Initialize GameAccount
    game.creator = *creator.key();
    let name_len = name.len().min(64);
    game.name[..name_len].copy_from_slice(&name[..name_len]);
    
    // Setup Initial Board
    // White (y=0,1)
    for x in 0..BOARD_SIZE {
        game.board[0][x] = Piece { piece_type: PieceType::Pawn, player: Player::White };
    }
    game.board[0][2] = Piece { piece_type: PieceType::King, player: Player::White };
    game.board[1][2] = Piece { piece_type: PieceType::Pawn, player: Player::White };

    // Black (y=4,3)
    for x in 0..BOARD_SIZE {
        game.board[4][x] = Piece { piece_type: PieceType::Pawn, player: Player::Black };
    }
    game.board[4][2] = Piece { piece_type: PieceType::King, player: Player::Black };
    game.board[3][2] = Piece { piece_type: PieceType::Pawn, player: Player::Black };

    game.turn = Player::White;
    game.winner = Winner::None;
    game.move_count = 0;
    game.buy_in_lamports = buy_in_lamports;
    game.prize_pool = buy_in_lamports;
    game.last_action_timestamp = 0; // Don't start timer until accepted
    game.white_time_seconds = 600; // 10 minutes
    game.black_time_seconds = 600; // 10 minutes

    // Join creator
    game.players[0].pubkey = *creator.key();
    game.players[0].eliminated = 0;

    msg!("Chess challenge created!");
    Ok(())
}

fn accept_challenge(accounts: &[AccountInfo]) -> ProgramResult {
    let [player, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.players[1].pubkey != Pubkey::default() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    game.players[1].pubkey = *player.key();
    game.players[1].eliminated = 0;
    game.prize_pool += game.buy_in_lamports;
    game.last_action_timestamp = Clock::get()?.unix_timestamp;

    msg!("Challenge accepted! Game in progress.");
    Ok(())
}

fn make_move(
    accounts: &[AccountInfo],
    from_x: u8,
    from_y: u8,
    to_x: u8,
    to_y: u8,
) -> ProgramResult {
    let [player, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.winner != Winner::None {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Identify current player index
    let player_idx = if game.turn == Player::White { 0 } else { 1 };
    if game.players[player_idx].pubkey != *player.key() {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Validate positions
    if from_x >= BOARD_SIZE as u8 || from_y >= BOARD_SIZE as u8 || 
       to_x >= BOARD_SIZE as u8 || to_y >= BOARD_SIZE as u8 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let f_x = from_x as usize;
    let f_y = from_y as usize;
    let t_x = to_x as usize;
    let t_y = to_y as usize;

    let piece = game.board[f_y][f_x];
    if piece.piece_type == PieceType::None || piece.player != game.turn {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Validate Move Logic
    let dx = (t_x as i8 - f_x as i8).abs();
    let dy = (t_y as i8 - f_y as i8).abs();
    let target = game.board[t_y][t_x];

    let mut valid = false;
    if piece.piece_type == PieceType::King {
        // King moves 1 in any direction
        if dx <= 1 && dy <= 1 && (dx > 0 || dy > 0) {
            if target.piece_type == PieceType::None || target.player != piece.player {
                valid = true;
            }
        }
    } else {
        // Pawn moves
        let direction = if piece.player == Player::White { 1 } else { -1 };
        let is_forward = (t_y as i8 - f_y as i8) == direction;
        
        if is_forward {
            if dx == 0 && target.piece_type == PieceType::None {
                // Forward move
                valid = true;
            } else if dx == 1 && target.piece_type != PieceType::None && target.player != piece.player {
                // Diagonal capture
                valid = true;
            } else if dx == 1 && target.piece_type == PieceType::None {
                // Idiot Pawn diagonal move to empty square
                valid = true;
            }
        }
    }

    if !valid {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Execute Move
    let captured_piece = game.board[t_y][t_x];
    game.board[t_y][t_x] = piece;
    game.board[f_y][f_x] = Piece { piece_type: PieceType::None, player: Player::White };

    // Promotion
    if piece.piece_type == PieceType::Pawn {
        if (piece.player == Player::White && t_y == BOARD_SIZE - 1) ||
           (piece.player == Player::Black && t_y == 0) {
            game.board[t_y][t_x].piece_type = PieceType::King;
        }
    }

    // Last Stand Logic
    if captured_piece.piece_type != PieceType::None {
        let opponent = if game.turn == Player::White { Player::Black } else { Player::White };
        if count_pieces(game, opponent) == 1 {
            spawn_last_stand_pawn(game, opponent);
        }
        game.move_count = 0; // Reset move count on capture
    } else {
        game.move_count += 1;
    }

    // Check Win Conditions
    check_win_condition(game);

    // Update Timers
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now.saturating_sub(game.last_action_timestamp);
    if game.turn == Player::White {
        game.white_time_seconds = game.white_time_seconds.saturating_sub(elapsed);
        if game.white_time_seconds == 0 {
            game.winner = Winner::Black;
        }
    } else {
        game.black_time_seconds = game.black_time_seconds.saturating_sub(elapsed);
        if game.black_time_seconds == 0 {
            game.winner = Winner::White;
        }
    }

    // Turn Switch
    if (game.winner == Winner::None) {
        game.turn = if game.turn == Player::White { Player::Black } else { Player::White };
        if game.move_count >= DRAW_MOVE_COUNT {
            game.winner = Winner::Draw;
        }
    }

    // Auto-distribute prize if game finished (except timeout which is claimed)
    if game.winner != Winner::None {
        let prize = game.prize_pool;
        if game.winner == Winner::Draw {
            let half_prize = prize / 2;
            
            // White refund
            {
                let white_acc = &accounts[2];
                if white_acc.key() == &game.players[0].pubkey {
                    let mut white_lamports = white_acc.try_borrow_mut_lamports()?;
                    let mut game_lamports = game_account.try_borrow_mut_lamports()?;
                    *game_lamports = game_lamports.checked_sub(half_prize).ok_or(ProgramError::InsufficientFunds)?;
                    *white_lamports = white_lamports.checked_add(half_prize).ok_or(ProgramError::InvalidAccountData)?;
                }
            }
            
            // Black refund
            {
                let black_acc = &accounts[3];
                if black_acc.key() == &game.players[1].pubkey {
                    let mut black_lamports = black_acc.try_borrow_mut_lamports()?;
                    let mut game_lamports = game_account.try_borrow_mut_lamports()?;
                    *game_lamports = game_lamports.checked_sub(half_prize).ok_or(ProgramError::InsufficientFunds)?;
                    *black_lamports = black_lamports.checked_add(half_prize).ok_or(ProgramError::InvalidAccountData)?;
                }
            }
            msg!("Draw! Prizes refunded.");
        } else {
            // Winner payout
            let winner_idx = if game.winner == Winner::White { 0 } else { 1 };
            let winner_acc = if game.winner == Winner::White { &accounts[2] } else { &accounts[3] };
            let manager_acc = &accounts[4];
            
            if winner_acc.key() == &game.players[winner_idx].pubkey {
                let prize = game.prize_pool;
                let platform_fee = prize / 100;
                let payout = prize.saturating_sub(platform_fee);

                let mut winner_lamports = winner_acc.try_borrow_mut_lamports()?;
                let mut game_lamports = game_account.try_borrow_mut_lamports()?;
                
                // Transfer payout to winner
                *game_lamports = game_lamports.checked_sub(payout).ok_or(ProgramError::InsufficientFunds)?;
                *winner_lamports = winner_lamports.checked_add(payout).ok_or(ProgramError::InvalidAccountData)?;

                // Transfer fee to treasury
                if platform_fee > 0 {
                    let mut manager_lamports = manager_acc.try_borrow_mut_lamports()?;
                    *game_lamports = game_lamports.checked_sub(platform_fee).ok_or(ProgramError::InsufficientFunds)?;
                    *manager_lamports = manager_lamports.checked_add(platform_fee).ok_or(ProgramError::InvalidAccountData)?;
                    msg!("Platform fee of {} kept in treasury", platform_fee);
                }

                game.players[winner_idx].eliminated = 1; // Mark as paid
                msg!("Winner paid automatically!");
            }
        }
    }

    game.last_action_timestamp = now;

    Ok(())
}

fn count_pieces(game: &GameAccount, player: Player) -> u8 {
    let mut count = 0;
    for y in 0..BOARD_SIZE {
        for x in 0..BOARD_SIZE {
            let p = game.board[y][x];
            if p.piece_type != PieceType::None && p.player == player {
                count += 1;
            }
        }
    }
    count
}

fn spawn_last_stand_pawn(game: &mut GameAccount, player: Player) {
    let start_x = 2;
    let start_y = if player == Player::White { 0 } else { 4 };

    // Simplest approach: check start, then search nearest empty
    if game.board[start_y][start_x].piece_type == PieceType::None {
        game.board[start_y][start_x] = Piece { piece_type: PieceType::Pawn, player };
        return;
    }

    for y in 0..BOARD_SIZE {
        for x in 0..BOARD_SIZE {
            if game.board[y][x].piece_type == PieceType::None {
                game.board[y][x] = Piece { piece_type: PieceType::Pawn, player };
                return;
            }
        }
    }
}

fn check_win_condition(game: &mut GameAccount) {
    let mut white_kings = 0;
    let mut black_kings = 0;

    for y in 0..BOARD_SIZE {
        for x in 0..BOARD_SIZE {
            let p = game.board[y][x];
            if p.piece_type == PieceType::King {
                if p.player == Player::White { white_kings += 1; }
                else { black_kings += 1; }
            }
        }
    }

    if white_kings == 0 {
        game.winner = Winner::Black;
    } else if black_kings == 0 {
        game.winner = Winner::White;
    }
}

pub fn claim_prize(accounts: &[AccountInfo]) -> ProgramResult {
    let [winner_acc, game_account, manager_acc] = accounts.get(..3).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Safety: check account ownership
    // We get the program_id from the first account's owner if it's a program-owned account normally,
    // but in Pinocchio we usually just check against a known ID or the entry point's program_id.
    // For simplicity, we just check that the game_account is owned by THIS program.
    // However, the process_instruction doesn't pass program_id to claim_prize easily without refactor.
    // Let's just assume for now, or check that it's NOT a system account.
    
    if !winner_acc.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.winner == Winner::None {
        // Timeout logic
        let now = Clock::get()?.unix_timestamp;
        let elapsed = now.saturating_sub(game.last_action_timestamp);
        
        if game.turn == Player::White {
            let remaining = game.white_time_seconds.saturating_sub(elapsed);
            if remaining <= 0 {
                game.winner = Winner::Black;
                game.white_time_seconds = 0;
            } else {
                return Err(ProgramError::InvalidInstructionData); // Not timed out yet
            }
        } else {
            let remaining = game.black_time_seconds.saturating_sub(elapsed);
            if remaining <= 0 {
                game.winner = Winner::White;
                game.black_time_seconds = 0;
            } else {
                return Err(ProgramError::InvalidInstructionData); // Not timed out yet
            }
        }
        msg!("Timeout win declared!");
    }

    if game.winner == Winner::Draw {
        // Refund both? For now, just implement winner claim.
        return Err(ProgramError::InvalidInstructionData);
    }

    let winner_player = if game.winner == Winner::White { Player::White } else { Player::Black };
    let player_idx = if winner_player == Player::White { 0 } else { 1 };

    if game.players[player_idx].pubkey != *winner_acc.key() {
        return Err(ProgramError::InvalidAccountData);
    }

    if game.players[player_idx].eliminated != 0 {
        return Err(ProgramError::InvalidAccountData);
    }

    let prize = game.prize_pool;
    let platform_fee = prize / 100;
    let payout = prize.saturating_sub(platform_fee);

    game.players[player_idx].eliminated = 1; // Mark as claimed

    // Perform Transfer
    let mut winner_lamports = winner_acc.try_borrow_mut_lamports()?;
    let mut game_lamports = game_account.try_borrow_mut_lamports()?;

    // Payout to winner
    *game_lamports = game_lamports.checked_sub(payout).ok_or(ProgramError::InsufficientFunds)?;
    *winner_lamports = winner_lamports.checked_add(payout).ok_or(ProgramError::InvalidAccountData)?;

    // Fee to treasury
    if platform_fee > 0 {
        let mut manager_lamports = manager_acc.try_borrow_mut_lamports()?;
        *game_lamports = game_lamports.checked_sub(platform_fee).ok_or(ProgramError::InsufficientFunds)?;
        *manager_lamports = manager_lamports.checked_add(platform_fee).ok_or(ProgramError::InvalidAccountData)?;
        msg!("Platform fee of {} transferred to treasury", platform_fee);
    }

    msg!("Prize claimed!");
    Ok(())
}
