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

pub const MAX_PLAYERS: usize = 2;
pub const MAX_ROUNDS: usize = 1;

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
pub enum Move {
    Rock = 0,
    Paper = 1,
    Scissors = 2,
    Fury = 3,
    Serenity = 4,
    Trickery = 5,
}

unsafe impl Zeroable for Move {}
unsafe impl Pod for Move {}

// ============================================================================
// Account Structures
// ============================================================================

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct PlayerData {
    pub pubkey: Pubkey,
    pub moves_committed: [u8; 32],
    pub moves_revealed: [u8; 5],
    pub eliminated: u8,
    pub _padding: [u8; 2],
}

// GameAccount struct size (all fields are fixed-size with bytemuck)

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct GameAccount {
    pub creator: Pubkey,                          // 32
    pub max_players: u8,                          // 1
    pub current_players: u8,                      // 1
    pub state: GameState,                         // 1
    pub _padding: [u8; 5],                        // 5 -> offset 40
    pub last_action_timestamp: i64,               // 8 -> offset 40
    pub buy_in_lamports: u64,                     // 8 -> offset 48
    pub prize_pool: u64,                          // 8 -> offset 56
    pub players: [PlayerData; MAX_PLAYERS],       // 2 * 72 = 144 -> offset 64
}

// ============================================================================
// Byte Offset Constants (for direct memory access)
// ============================================================================

pub const OFFSET_CREATOR: usize = 0;
pub const OFFSET_MAX_PLAYERS: usize = 32;
pub const OFFSET_CURRENT_PLAYERS: usize = 33;
pub const OFFSET_STATE: usize = 34;
pub const OFFSET_LAST_ACTION: usize = 40;
pub const OFFSET_BUY_IN: usize = 48;
pub const OFFSET_PRIZE_POOL: usize = 56;
pub const OFFSET_PLAYERS: usize = 64;
 // After all metadata

const PLAYER_SIZE: usize = 72; // 32 (pubkey) + 32 (committed) + 5 (revealed) + 1 (eliminated) + 2 (padding)

fn set_creator(data: &mut [u8], creator: &Pubkey) {
    data[OFFSET_CREATOR..OFFSET_CREATOR + 32].copy_from_slice(creator.as_ref());
}

fn get_max_players(data: &[u8]) -> u8 {
    data[OFFSET_MAX_PLAYERS]
}

fn set_max_players(data: &mut [u8], value: u8) {
    data[OFFSET_MAX_PLAYERS] = value;
}

fn set_current_players(data: &mut [u8], value: u8) {
    data[OFFSET_CURRENT_PLAYERS] = value;
}


fn get_state(data: &[u8]) -> GameState {
    unsafe { *(data.as_ptr().add(OFFSET_STATE) as *const GameState) }
}

fn set_state(data: &mut [u8], state: GameState) {
    data[OFFSET_STATE] = state as u8;
}

fn get_last_action_timestamp(data: &[u8]) -> i64 {
    i64::from_le_bytes(data[OFFSET_LAST_ACTION..OFFSET_LAST_ACTION + 8].try_into().unwrap())
}

fn set_last_action_timestamp(data: &mut [u8], value: i64) {
    data[OFFSET_LAST_ACTION..OFFSET_LAST_ACTION + 8].copy_from_slice(&value.to_le_bytes());
}

fn get_buy_in(data: &[u8]) -> u64 {
    u64::from_le_bytes(data[OFFSET_BUY_IN..OFFSET_BUY_IN + 8].try_into().unwrap())
}

fn set_buy_in(data: &mut [u8], value: u64) {
    data[OFFSET_BUY_IN..OFFSET_BUY_IN + 8].copy_from_slice(&value.to_le_bytes());
}

fn get_prize_pool(data: &[u8]) -> u64 {
    u64::from_le_bytes(data[OFFSET_PRIZE_POOL..OFFSET_PRIZE_POOL + 8].try_into().unwrap())
}

fn set_prize_pool(data: &mut [u8], value: u64) {
    data[OFFSET_PRIZE_POOL..OFFSET_PRIZE_POOL + 8].copy_from_slice(&value.to_le_bytes());
}

fn get_player_mut(data: &mut [u8], index: u8) -> &mut PlayerData {
    let offset = OFFSET_PLAYERS + (index as usize * PLAYER_SIZE);
    bytemuck::from_bytes_mut(&mut data[offset..offset + PLAYER_SIZE])
}

fn get_player(data: &[u8], index: u8) -> &PlayerData {
    let offset = OFFSET_PLAYERS + (index as usize * PLAYER_SIZE);
    bytemuck::from_bytes(&data[offset..offset + PLAYER_SIZE])
}

// Bracket logic removed

// ============================================================================
// Instructions
// ============================================================================

pub enum GameInstruction {
    CreateChallenge {
        buy_in_lamports: u64,
        moves_hash: [u8; 32],
    },
    AcceptChallenge {
        moves: [Move; 5],
    },
    RevealMoves {
        moves: [Move; 5],
        salt: u64,
    },
    DistributePrize,
    CancelChallenge,
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
            // CreateChallenge: [0] disc, [1..9] buy_in, [9..41] hash
            if instruction_data.len() < 41 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let buy_in = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            let moves_hash: [u8; 32] = instruction_data[9..41].try_into().unwrap();
            
            create_challenge(_program_id, accounts, buy_in, moves_hash)
        }
        1 => {
            // AcceptChallenge: [0] disc, [1..6] moves
            if instruction_data.len() < 6 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let moves = [
                Move::from_u8(instruction_data[1])?,
                Move::from_u8(instruction_data[2])?,
                Move::from_u8(instruction_data[3])?,
                Move::from_u8(instruction_data[4])?,
                Move::from_u8(instruction_data[5])?,
            ];

            // Strategies cannot be used on the first round (moves[0])
            if moves[0] as u8 > 2 {
                msg!("Round 1 move must be a basic move (Rock, Paper, or Scissors)");
                return Err(ProgramError::InvalidInstructionData);
            }

            accept_challenge(_program_id, accounts, moves)
        }
        2 => {
            // RevealMoves: [0] disc, [1..6] moves, [6..14] salt
            if instruction_data.len() < 14 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let moves = [
                Move::from_u8(instruction_data[1])?,
                Move::from_u8(instruction_data[2])?,
                Move::from_u8(instruction_data[3])?,
                Move::from_u8(instruction_data[4])?,
                Move::from_u8(instruction_data[5])?,
            ];

            // Strategies cannot be used on the first round (moves[0])
            if moves[0] as u8 > 2 {
                msg!("Round 1 move must be a basic move (Rock, Paper, or Scissors)");
                return Err(ProgramError::InvalidInstructionData);
            }

            let salt = u64::from_le_bytes(instruction_data[6..14].try_into().unwrap());
            reveal_moves(_program_id, accounts, moves, salt)
        }
        3 => distribute_prize(_program_id, accounts),
        4 => cancel_challenge(_program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

impl Move {
    fn from_u8(val: u8) -> Result<Self, ProgramError> {
        match val {
            0 => Ok(Move::Rock),
            1 => Ok(Move::Paper),
            2 => Ok(Move::Scissors),
            3 => Ok(Move::Fury),
            4 => Ok(Move::Serenity),
            5 => Ok(Move::Trickery),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

impl PlayerData {
    fn has_revealed(&self) -> bool {
        self.moves_revealed[0] != 0
    }

    fn get_move(&self, index: usize) -> Option<Move> {
        match self.moves_revealed[index] {
            0 => None,
            1 => Some(Move::Rock),
            2 => Some(Move::Paper),
            3 => Some(Move::Scissors),
            4 => Some(Move::Fury),
            5 => Some(Move::Serenity),
            6 => Some(Move::Trickery),
            _ => None,
        }
    }

    fn set_moves(&mut self, moves: &[Move; 5]) {
        for (i, &m) in moves.iter().enumerate() {
            self.moves_revealed[i] = (m as u8) + 1;
        }
    }
}

pub fn create_move_hash(moves: &[Move; 5], salt: u64) -> [u8; 32] {
    let mut hash = [0u8; 32];
    let mut input = [0u8; 13];
    for i in 0..5 {
        input[i] = moves[i] as u8;
    }
    input[5..13].copy_from_slice(&salt.to_le_bytes());

    for (i, val) in input.iter().enumerate() {
        let pos = i % 32;
        hash[pos] = ((hash[pos] as u16 + *val as u16) * 7 + i as u16) as u8;
    }
    for i in 0..32 {
        let next = (i + 1) % 32;
        hash[i] = hash[i].wrapping_add(hash[next]).wrapping_mul(3);
    }
    hash
}

fn determine_winner(move1: Move, move2: Move) -> Option<u8> {
    match (move1, move2) {
        (Move::Rock, Move::Scissors) => Some(0),
        (Move::Paper, Move::Rock) => Some(0),
        (Move::Scissors, Move::Paper) => Some(0),
        (Move::Scissors, Move::Rock) => Some(1),
        (Move::Rock, Move::Paper) => Some(1),
        (Move::Paper, Move::Scissors) => Some(1),
        _ => None,
    }
}

fn resolve_strategy(strategy: Move, prev_self_move: Move, prev_opponent_move: Move) -> Move {
    match strategy {
        Move::Fury => {
            // Make whatever move would have beaten your opponent's last move
            match prev_opponent_move {
                Move::Rock => Move::Paper,
                Move::Paper => Move::Scissors,
                Move::Scissors => Move::Rock,
                _ => prev_opponent_move, // Should not happen with basic moves
            }
        }
        Move::Serenity => {
            // Make the same move you made in the last round
            prev_self_move
        }
        Move::Trickery => {
            // Make whatever move would have lost to your opponent's last move
            match prev_opponent_move {
                Move::Rock => Move::Scissors,
                Move::Paper => Move::Rock,
                Move::Scissors => Move::Paper,
                _ => prev_opponent_move, // Should not happen with basic moves
            }
        }
        _ => strategy, // Basic move
    }
}

fn resolve_match(player1: &PlayerData, player2: &PlayerData) -> Option<u8> {
    let mut p1_wins = 0;
    let mut p2_wins = 0;

    let mut p1_prev_resolved = None;
    let mut p2_prev_resolved = None;

    for i in 0..5 {
        if let (Some(m1), Some(m2)) = (player1.get_move(i), player2.get_move(i)) {
            let m1_resolved = if i == 0 {
                m1
            } else {
                resolve_strategy(m1, p1_prev_resolved.unwrap(), p2_prev_resolved.unwrap())
            };

            let m2_resolved = if i == 0 {
                m2
            } else {
                resolve_strategy(m2, p2_prev_resolved.unwrap(), p1_prev_resolved.unwrap())
            };

            match determine_winner(m1_resolved, m2_resolved) {
                Some(0) => p1_wins += 1,
                Some(1) => p2_wins += 1,
                _ => {}
            }

            p1_prev_resolved = Some(m1_resolved);
            p2_prev_resolved = Some(m2_resolved);
        }
    }

    if p1_wins > p2_wins {
        Some(0)
    } else if p2_wins > p1_wins {
        Some(1)
    } else {
        Some(0) // Tiebreaker: player1 wins
    }
}

// Matchup logic removed

// ============================================================================
// Instruction Handlers
// ============================================================================

fn create_challenge(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    buy_in_lamports: u64,
    moves_hash: [u8; 32],
) -> ProgramResult {
    let [creator, game_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut data = game_account.try_borrow_mut_data()?;

    // Initialize GameAccount
    set_creator(&mut data, creator.key());
    set_max_players(&mut data, 2);
    set_state(&mut data, GameState::WaitingForPlayers);
    set_buy_in(&mut data, buy_in_lamports);
    set_last_action_timestamp(&mut data, Clock::get()?.unix_timestamp);

    // Auto-join creator
    let p1 = get_player_mut(&mut data, 0);
    p1.pubkey = *creator.key();
    p1.moves_committed = moves_hash;
    p1.moves_revealed = [0; 5];
    p1.eliminated = 0;

    set_current_players(&mut data, 1);
    set_prize_pool(&mut data, buy_in_lamports);

    msg!("Challenge created: {} lamports. Waiting for acceptor.", buy_in_lamports);
    Ok(())
}

fn accept_challenge(program_id: &Pubkey, accounts: &[AccountInfo], moves: [Move; 5]) -> ProgramResult {
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

    if get_state(&data) != GameState::WaitingForPlayers {
        msg!("Game not accepting players");
        return Err(ProgramError::InvalidInstructionData);
    }

    let buy_in = get_buy_in(&data);

    // Join as player 2
    let p2 = get_player_mut(&mut data, 1);
    p2.pubkey = *player.key();
    p2.moves_committed = [1u8; 32]; // Signal commitment
    p2.set_moves(&moves);
    p2.eliminated = 0;

    set_current_players(&mut data, 2);
    let prize = get_prize_pool(&data);
    set_prize_pool(&mut data, prize.checked_add(buy_in).ok_or(ProgramError::ArithmeticOverflow)?);
    set_state(&mut data, GameState::InProgress); // Challenge accepted, now creator must reveal
    set_last_action_timestamp(&mut data, Clock::get()?.unix_timestamp);

    msg!("Challenge accepted! Waiting for creator to reveal.");
    Ok(())
}

fn reveal_moves(program_id: &Pubkey, accounts: &[AccountInfo], moves: [Move; 5], salt: u64) -> ProgramResult {
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

    if get_state(&data) != GameState::InProgress {
        msg!("Game not in reveal phase");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Check if caller is player 1 (creator)
    if get_player(&data, 0).pubkey != *player.key() {
        msg!("Only challenge creator can reveal first");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Verify hash
    let committed_hash = get_player(&data, 0).moves_committed;
    let computed_hash = create_move_hash(&moves, salt);

    if computed_hash != committed_hash {
        msg!("Hash mismatch! Commitment failed.");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Reveal moves
    {
        let p1 = get_player_mut(&mut data, 0);
        p1.set_moves(&moves);
    }

    // Resolve immediately against Player 2's locked moves
    let p1 = get_player(&data, 0);
    let p2 = get_player(&data, 1);
    match resolve_match(p1, p2) {
        Some(0) => {
            msg!("Player 1 (Creator) wins!");
            get_player_mut(&mut data, 1).eliminated = 1;
        }
        Some(1) => {
            msg!("Player 2 (Acceptor) wins!");
            get_player_mut(&mut data, 0).eliminated = 1;
        }
        _ => {
            msg!("Tie! Creator wins by default tiebreaker.");
            get_player_mut(&mut data, 1).eliminated = 1;
        }
    }

    set_state(&mut data, GameState::Finished);
    msg!("Match resolved successfully.");
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
    if get_state(&data) != GameState::WaitingForPlayers {
        msg!("Challenge already accepted or finished.");
        return Err(ProgramError::InvalidInstructionData);
    }

    let p1 = get_player(&data, 0);
    if p1.pubkey != *creator.key() {
        msg!("Only the creator can cancel an unaccepted challenge.");
        return Err(ProgramError::InvalidInstructionData);
    }

    set_state(&mut data, GameState::Finished);
    let buy_in = get_buy_in(&data);
    drop(data);
    msg!("Challenge manually cancelled by creator: {:?}", creator.key());
    transfer_prize(creator, game_account, buy_in)
}


// Matchmaking pool logic removed in favor of Challenge/Accept model

fn distribute_prize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let [winner, game_account, manager_info] = accounts.get(..3).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Check owner
    if *game_account.owner() != *program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    
    if winner.is_signer() {
        // We no longer require the winner to be a signer so anyone can crank this instruction
    }

    // Validate Treasury PDA
    const EXPECTED_TREASURY: &[u8; 32] = include_bytes!("treasury.bin");
    if manager_info.key().as_ref() != EXPECTED_TREASURY.as_ref() {
        msg!("Invalid treasury PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    let amount_to_transfer = {
        let mut data = game_account.try_borrow_mut_data()?;
        let state = get_state(&data);
        let max_players = get_max_players(&data);

        if state == GameState::InProgress {
            // Forfeit check (only for Quickplay/2-player for now)
            if max_players != 2 {
                msg!("Forfeit only available for 1v1 quickplay");
                return Err(ProgramError::InvalidInstructionData);
            }

            let now = Clock::get()?.unix_timestamp;
            let last_action = get_last_action_timestamp(&data);
            if now < last_action + 90 {
                msg!("Wait for 90s deadline: {}s remaining", (last_action + 90) - now);
                return Err(ProgramError::InvalidInstructionData);
            }

            // Who stalled?
            let p1 = get_player(&data, 0);
            let p2 = get_player(&data, 1);

            let p1_committed = p1.moves_committed != [0u8; 32];
            let p2_committed = p2.moves_committed != [0u8; 32];
            let p1_revealed = p1.has_revealed();
            let p2_revealed = p2.has_revealed();

            let winner_idx = if p1_committed && !p2_committed {
                Some(0)
            } else if p2_committed && !p1_committed {
                Some(1)
            } else if p1_revealed && !p2_revealed {
                Some(0)
            } else if p2_revealed && !p1_revealed {
                Some(1)
            } else {
                None
            };

            match winner_idx {
                Some(idx) => {
                    if get_player(&data, idx).pubkey != *winner.key() {
                        msg!("You are not the winner by forfeit");
                        return Err(ProgramError::InvalidInstructionData);
                    }
                    set_state(&mut data, GameState::Finished);
                    msg!("Winner by forfeit: {:?}", winner.key());
                }
                None => {
                    // Dual stalling! Both or neither acted.
                    // Allow refund: give 100% of buy-in back to the caller
                    let mut caller_idx = None;
                    for i in 0..max_players {
                        if get_player(&data, i).pubkey == *winner.key() {
                            caller_idx = Some(i);
                            break;
                        }
                    }

                    match caller_idx {
                        Some(idx) => {
                            let buy_in = get_buy_in(&data);
                            {
                                let player = get_player_mut(&mut data, idx);
                                if player.eliminated != 0 {
                                    msg!("Already refunded or eliminated");
                                    return Err(ProgramError::InvalidInstructionData);
                                }
                                player.eliminated = 1;
                            }

                            let mut active_players = 0;
                            for i in 0..max_players {
                                let p = get_player(&data, i);
                                if p.pubkey != Pubkey::default() && p.eliminated == 0 {
                                    active_players += 1;
                                }
                            }
                            if active_players == 0 {
                                set_state(&mut data, GameState::Finished);
                            }

                            msg!("Refund granted to stalled player: {:?}", winner.key());
                            drop(data);
                            return transfer_prize(winner, game_account, buy_in);
                        }
                        None => {
                            msg!("Caller not in game");
                            return Err(ProgramError::InvalidInstructionData);
                        }
                    }
                }
            }
        } else if state == GameState::WaitingForPlayers {
            let now = Clock::get()?.unix_timestamp;
            let last_action = get_last_action_timestamp(&data);
            if now < last_action + 90 {
                msg!("Wait for 90s to cancel challenge: {}s remaining", (last_action + 90) - now);
                return Err(ProgramError::InvalidInstructionData);
            }

            // Creator can refund
            let creator_pubkey = get_player(&data, 0).pubkey;
            if creator_pubkey != *winner.key() {
                msg!("Only creator can refund an unaccepted challenge");
                return Err(ProgramError::InvalidInstructionData);
            }

            set_state(&mut data, GameState::Finished);
            msg!("Challenge cancelled by creator: {:?}", winner.key());
            let buy_in = get_buy_in(&data);
            drop(data);
            return transfer_prize(winner, game_account, buy_in);
        } else if state != GameState::Finished {
            msg!("Game not finished (state: {:?})", state);
            return Err(ProgramError::InvalidInstructionData);
        }

        // Find winner (only non-eliminated player, search all slots)
        let mut winner_player = None;
        for i in 0..max_players {
            let player = get_player(&data, i);
            if player.pubkey != Pubkey::default() && player.eliminated == 0 {
                winner_player = Some(player);
                break;
            }
        }

        let winner_player_data = winner_player.ok_or(ProgramError::InvalidAccountData)?;
        if winner_player_data.pubkey != *winner.key() {
            msg!("Not the winner");
            return Err(ProgramError::InvalidAccountData);
        }

        let prize_pool = get_prize_pool(&data);
        // Apply 1% platform fee (captured in treasury)
        let amount_to_winner = prize_pool.checked_mul(99).and_then(|v| v.checked_div(100)).ok_or(ProgramError::InvalidAccountData)?;
        let fee = prize_pool.saturating_sub(amount_to_winner);

        // Transfer fee to treasury
        if fee > 0 {
            let mut game_lamports = game_account.try_borrow_mut_lamports()?;
            let mut manager_lamports = manager_info.try_borrow_mut_lamports()?;
            *game_lamports = game_lamports.checked_sub(fee).ok_or(ProgramError::InsufficientFunds)?;
            *manager_lamports = manager_lamports.checked_add(fee).ok_or(ProgramError::InvalidAccountData)?;
            msg!("Platform fee of {} transferred to treasury", fee);
        }

        amount_to_winner
    }; // data is dropped here

    transfer_prize(winner, game_account, amount_to_transfer)
}

fn transfer_prize(
    winner: &AccountInfo,
    game_account: &AccountInfo,
    amount: u64,
) -> ProgramResult {
    // Transfer amount, accounting for rent-exempt minimum
    let mut winner_lamports = winner.try_borrow_mut_lamports()?;
    let mut game_lamports = game_account.try_borrow_mut_lamports()?;

    // Calculate rent-exempt minimum for this account
    let rent_exempt_minimum = 1_000u64; // Small buffer to keep account alive

    // Available balance is total lamports minus rent-exempt minimum
    let available_balance = game_lamports.checked_sub(rent_exempt_minimum)
        .ok_or(ProgramError::InsufficientFunds)?;

    // Transfer the lesser of amount or available_balance
    let transfer_amount = amount.min(available_balance);

    if transfer_amount < amount {
        msg!("Warning: Insufficient funds. Transferring {} instead of {}",
            transfer_amount, amount);
    }

    *game_lamports = game_lamports.checked_sub(transfer_amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    *winner_lamports = winner_lamports.checked_add(transfer_amount)
        .ok_or(ProgramError::InvalidAccountData)?;

    msg!("Transferred {} lamports to {:?}", transfer_amount, winner.key());

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests;

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

