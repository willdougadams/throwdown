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
    pub last_action_timestamp: i64,               // 8  -> 40
    pub buy_in_lamports: u64,                     // 8  -> 48
    pub prize_pool: u64,                          // 8  -> 56
    pub white_time_seconds: i64,                  // 8  -> 64
    pub black_time_seconds: i64,                  // 8  -> 72
    pub players: [PlayerData; MAX_PLAYERS],       // 2 * 40 = 80 -> 152
    pub board: [[Piece; BOARD_SIZE]; BOARD_SIZE], // 5 * 5 * 2 = 50 -> 202
    pub turn: Player,                             // 1 -> 203
    pub winner: Winner,                           // 1 -> 204
    pub move_count: u8,                           // 1 -> 205
    pub _padding: [u8; 3],                        // 3 -> 208 (8-byte aligned)
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

    msg!("Chess: process_instruction. Data len: {}", instruction_data.len());
    match instruction_data[0] {
        0 => {
            // CreateChallenge: [0] disc, [1..9] buy_in
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let buy_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            create_challenge(_program_id, accounts, buy_in)
        }
        1 => accept_challenge(_program_id, accounts),
        2 => {
            // MakeMove: [0] disc, [1] from_x, [2] from_y, [3] to_x, [4] to_y
            if instruction_data.len() < 5 {
                return Err(ProgramError::InvalidInstructionData);
            }
            make_move(
                _program_id,
                accounts,
                instruction_data[1],
                instruction_data[2],
                instruction_data[3],
                instruction_data[4],
            )
        }
        3 => distribute_prize(_program_id, accounts),
        4 => cancel_challenge(_program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// ============================================================================
// Logic Handlers
// ============================================================================

fn create_challenge(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    buy_in_lamports: u64,
) -> ProgramResult {
    msg!("create_challenge: starting. accounts.len={}", accounts.len());
    let [creator, game_account] = accounts.get(..2).ok_or(ProgramError::Custom(99))? else {
        msg!("create_challenge: failed to get accounts");
        return Err(ProgramError::Custom(99));
    };
    
    msg!("create_challenge: checking signer");
    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("create_challenge: checking owner");
    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    // Initialize GameAccount
    game.creator = *creator.key();
    
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

fn accept_challenge(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let [player, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.players[1].pubkey != Pubkey::default() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    game.players[1].pubkey = *player.key();
    game.players[1].eliminated = 0;
    game.prize_pool = game.prize_pool.checked_add(game.buy_in_lamports).ok_or(ProgramError::ArithmeticOverflow)?;
    game.last_action_timestamp = Clock::get()?.unix_timestamp;

    msg!("Challenge accepted! Game in progress.");
    Ok(())
}

fn make_move(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    from_x: u8,
    from_y: u8,
    to_x: u8,
    to_y: u8,
) -> ProgramResult {
    msg!("Chess: make_move from ({}, {}) to ({}, {})", from_x, from_y, to_x, to_y);
    let [player, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    // Validate Treasury PDA
    let manager_acc = accounts.get(4).ok_or(ProgramError::NotEnoughAccountKeys)?;
    const EXPECTED_TREASURY: &[u8; 32] = include_bytes!("treasury.bin");
    if manager_acc.key().as_ref() != EXPECTED_TREASURY.as_ref() {
        msg!("Invalid treasury PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.winner != Winner::None {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Identify current player index
    let player_idx = if game.turn == Player::White { 0 } else { 1 };
    msg!("Chess: game.turn={:?}, idx={}, signer={:?}", game.turn, player_idx, player.key());
    if game.players[player_idx].pubkey != *player.key() {
        msg!("Chess: Signer mismatch! Expected={:?}, Got={:?}", game.players[player_idx].pubkey, player.key());
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
    msg!("Chess: from_piece={:?}, player={:?}", piece.piece_type, piece.player);
    if piece.piece_type == PieceType::None || piece.player != game.turn {
        msg!("Chess: Invalid piece or not your turn! piece.player={:?}, game.turn={:?}", piece.player, game.turn);
        return Err(ProgramError::InvalidInstructionData);
    }

    // Validate Move Logic
    let dx = (t_x as i8 - f_x as i8).abs();
    let dy = (t_y as i8 - f_y as i8).abs();
    let target = game.board[t_y][t_x];

    let mut valid = false;
    if piece.piece_type == PieceType::King {
        // King moves 1 in any direction
        if dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)
            && (target.piece_type == PieceType::None || target.player != piece.player) {
                valid = true;
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
    if piece.piece_type == PieceType::Pawn
        && ((piece.player == Player::White && t_y == BOARD_SIZE - 1) ||
           (piece.player == Player::Black && t_y == 0)) {
            game.board[t_y][t_x].piece_type = PieceType::King;
        }

    // Last Stand Logic
    if captured_piece.piece_type != PieceType::None {
        let opponent = if game.turn == Player::White { Player::Black } else { Player::White };
        if count_pieces(game, opponent) == 1 {
            spawn_last_stand_pawn(game, opponent);
        }
        game.move_count = 0; // Reset move count on capture
    } else {
        game.move_count = game.move_count.saturating_add(1);
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
    if game.winner == Winner::None  {
        game.turn = if game.turn == Player::White { Player::Black } else { Player::White };
        if game.move_count >= DRAW_MOVE_COUNT {
            game.winner = Winner::Draw;
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

pub fn distribute_prize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let [winner_acc, game_account, manager_acc] = accounts.get(..3).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    // Safety: check account ownership
    // We get the program_id from the first account's owner if it's a program-owned account normally,
    // but in Pinocchio we usually just check against a known ID or the entry point's program_id.
    // For simplicity, we just check that the game_account is owned by THIS program.
    // However, the process_instruction doesn't pass program_id to distribute_prize easily without refactor.
    // Let's just assume for now, or check that it's NOT a system account.
    
    if winner_acc.is_signer() {
        // We no longer require the winner to be a signer so anyone can crank this instruction
        // But we leave this block empty just as a note, or we can remove the if block cleanly.
    }

    // Validate Treasury PDA
    const EXPECTED_TREASURY: &[u8; 32] = include_bytes!("treasury.bin");
    if manager_acc.key().as_ref() != EXPECTED_TREASURY.as_ref() {
        msg!("Invalid treasury PDA");
        return Err(ProgramError::InvalidAccountData);
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
        let player_idx = if game.players[0].pubkey == *winner_acc.key() {
            0
        } else if game.players[1].pubkey == *winner_acc.key() {
            1
        } else {
            return Err(ProgramError::InvalidAccountData);
        };

        if game.players[player_idx].eliminated != 0 {
            return Err(ProgramError::InvalidAccountData);
        }

        game.players[player_idx].eliminated = 1;
        let payout = game.buy_in_lamports;
        
        let mut winner_lamports = winner_acc.try_borrow_mut_lamports()?;
        let mut game_lamports = game_account.try_borrow_mut_lamports()?;
        *game_lamports = game_lamports.checked_sub(payout).ok_or(ProgramError::InsufficientFunds)?;
        *winner_lamports = winner_lamports.checked_add(payout).ok_or(ProgramError::InvalidAccountData)?;
        msg!("Draw prize claimed!");
        return Ok(());
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

fn cancel_challenge(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let [creator, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut data = game_account.try_borrow_mut_data()?;
    let game = get_game_mut(&mut data);

    if game.players[1].pubkey != Pubkey::default() {
        msg!("Challenge already accepted.");
        return Err(ProgramError::InvalidInstructionData);
    }

    if game.players[0].pubkey != *creator.key() {
        msg!("Only the creator can cancel an unaccepted challenge.");
        return Err(ProgramError::InvalidInstructionData);
    }

    let buy_in = game.buy_in_lamports;
    game.winner = Winner::Draw; 
    game.players[0].eliminated = 1;

    let mut creator_lamports = creator.try_borrow_mut_lamports()?;
    let mut game_lamports = game_account.try_borrow_mut_lamports()?;

    let rent_exempt_minimum = 1_000u64;
    let available_balance = game_lamports.checked_sub(rent_exempt_minimum).unwrap_or(0);
    let transfer_amount = buy_in.min(available_balance);

    *game_lamports = game_lamports.checked_sub(transfer_amount).ok_or(ProgramError::InsufficientFunds)?;
    *creator_lamports = creator_lamports.checked_add(transfer_amount).ok_or(ProgramError::InvalidAccountData)?;

    msg!("Challenge manually cancelled by creator: {:?}", creator.key());
    Ok(())
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
/// # Safety
/// This function is intended for mock testing environments off-chain.
pub unsafe extern "C" fn sol_memset_(s: *mut u8, c: u8, n: usize) {
    std::ptr::write_bytes(s, c, n);
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
/// # Safety
/// This function is intended for mock testing environments off-chain.
pub unsafe extern "C" fn sol_memcpy_(dst: *mut u8, src: *const u8, n: usize) {
    std::ptr::copy_nonoverlapping(src, dst, n);
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
/// # Safety
/// This function is intended for mock testing environments off-chain.
pub unsafe extern "C" fn sol_memmove_(dst: *mut u8, src: *const u8, n: usize) {
    std::ptr::copy(src, dst, n);
}

