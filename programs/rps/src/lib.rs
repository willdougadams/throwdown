use bytemuck::{Pod, Zeroable};
use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
};

entrypoint!(process_instruction);

// ============================================================================
// Constants
// ============================================================================

pub const MAX_PLAYERS: usize = 64;
pub const MAX_ROUNDS: usize = 6; // 64->32->16->8->4->2->1

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
    pub moves_revealed: [[u8; 5]; MAX_ROUNDS], // Store moves for each round [round][move_index]
    pub eliminated: u8,
    pub _padding: [u8; 2],
}

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct GameAccount {
    pub creator: Pubkey,
    pub name: [u8; 64],
    pub description: [u8; 256],
    pub max_players: u8,
    pub current_players: u8,
    pub state: GameState,
    pub current_round: u8,
    pub total_rounds: u8,
    pub matchups_resolved_in_round: u8,
    pub _padding: [u8; 2],
    pub buy_in_lamports: u64,
    pub prize_pool: u64,
    pub players: [PlayerData; MAX_PLAYERS],
    pub bracket: [[u8; MAX_PLAYERS]; MAX_ROUNDS], // bracket[round][position] = player_index (255 = empty)
}

// ============================================================================
// Byte Offset Constants (for direct memory access)
// ============================================================================

const OFFSET_CREATOR: usize = 0;
const OFFSET_NAME: usize = 32;
const OFFSET_DESCRIPTION: usize = 96; // 32 + 64
const OFFSET_MAX_PLAYERS: usize = 352; // 32 + 64 + 256
const OFFSET_CURRENT_PLAYERS: usize = 353;
const OFFSET_STATE: usize = 354;
const OFFSET_CURRENT_ROUND: usize = 355;
const OFFSET_TOTAL_ROUNDS: usize = 356;
const OFFSET_MATCHUPS_RESOLVED: usize = 357;
const OFFSET_BUY_IN: usize = 360; // After padding
const OFFSET_PRIZE_POOL: usize = 368;
const OFFSET_PLAYERS: usize = 376; // After all metadata

const PLAYER_SIZE: usize = 97; // 32 (pubkey) + 32 (committed) + 30 (revealed per round) + 1 (eliminated) + 2 (padding)
const BRACKET_OFFSET: usize = OFFSET_PLAYERS + (MAX_PLAYERS * PLAYER_SIZE); // After all players

fn set_creator(data: &mut [u8], creator: &Pubkey) {
    data[OFFSET_CREATOR..OFFSET_CREATOR + 32].copy_from_slice(creator.as_ref());
}

fn set_name(data: &mut [u8], name: &[u8]) {
    let len = name.len().min(64);
    data[OFFSET_NAME..OFFSET_NAME + len].copy_from_slice(&name[..len]);
    if len < 64 {
        data[OFFSET_NAME + len..OFFSET_NAME + 64].fill(0);
    }
}

fn set_description(data: &mut [u8], description: &[u8]) {
    let len = description.len().min(256);
    data[OFFSET_DESCRIPTION..OFFSET_DESCRIPTION + len].copy_from_slice(&description[..len]);
    if len < 256 {
        data[OFFSET_DESCRIPTION + len..OFFSET_DESCRIPTION + 256].fill(0);
    }
}

fn get_max_players(data: &[u8]) -> u8 {
    data[OFFSET_MAX_PLAYERS]
}

fn set_max_players(data: &mut [u8], value: u8) {
    data[OFFSET_MAX_PLAYERS] = value;
}

fn get_current_players(data: &[u8]) -> u8 {
    data[OFFSET_CURRENT_PLAYERS]
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

fn get_current_round(data: &[u8]) -> u8 {
    data[OFFSET_CURRENT_ROUND]
}

fn set_current_round(data: &mut [u8], value: u8) {
    data[OFFSET_CURRENT_ROUND] = value;
}

fn get_total_rounds(data: &[u8]) -> u8 {
    data[OFFSET_TOTAL_ROUNDS]
}

fn set_total_rounds(data: &mut [u8], value: u8) {
    data[OFFSET_TOTAL_ROUNDS] = value;
}

fn get_matchups_resolved(data: &[u8]) -> u8 {
    data[OFFSET_MATCHUPS_RESOLVED]
}

fn set_matchups_resolved(data: &mut [u8], value: u8) {
    data[OFFSET_MATCHUPS_RESOLVED] = value;
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

fn get_bracket_slot(data: &[u8], round: u8, position: usize) -> u8 {
    let offset = BRACKET_OFFSET + (round as usize * MAX_PLAYERS) + position;
    data[offset]
}

fn set_bracket_slot(data: &mut [u8], round: u8, position: usize, player_idx: u8) {
    let offset = BRACKET_OFFSET + (round as usize * MAX_PLAYERS) + position;
    data[offset] = player_idx;
}

fn init_bracket(data: &mut [u8]) {
    let bracket_size = MAX_PLAYERS * MAX_ROUNDS;
    data[BRACKET_OFFSET..BRACKET_OFFSET + bracket_size].fill(255);
}

// ============================================================================
// Instructions
// ============================================================================

pub enum GameInstruction {
    CreateGame {
        max_players: u8,
          buy_in_lamports: u64,
    },
    JoinGame,
    SubmitMoves {
        moves_hash: [u8; 32],
    },
    RevealMoves {
        moves: [Move; 5],
        salt: u64,
    },
    ClaimPrize,
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
            // Instruction format:
            // [0]: instruction discriminator (0 for CreateGame)
            // [1]: max_players (u8)
            // [2..10]: buy_in_lamports (u64, little-endian)
            // [10..11]: name_len (u8)
            // [11..11+name_len]: name bytes
            // [11+name_len..11+name_len+1]: description_len (u8)
            // [11+name_len+1..]: description bytes

            if instruction_data.len() < 11 {
                return Err(ProgramError::InvalidInstructionData);
            }

            let max_players = instruction_data[1];
            let buy_in_lamports = u64::from_le_bytes(instruction_data[2..10].try_into().unwrap());
            let name_len = instruction_data[10] as usize;

            if instruction_data.len() < 11 + name_len + 1 {
                return Err(ProgramError::InvalidInstructionData);
            }

            let name = &instruction_data[11..11 + name_len];
            let description_len = instruction_data[11 + name_len] as usize;

            if instruction_data.len() < 11 + name_len + 1 + description_len {
                return Err(ProgramError::InvalidInstructionData);
            }

            let description = &instruction_data[11 + name_len + 1..11 + name_len + 1 + description_len];

            create_game(accounts, max_players, buy_in_lamports, name, description)
        }
        1 => {
            // Instruction format:
            // [0]: instruction discriminator (1 for JoinGame)
            // [1]: player_slot (u8)
            if instruction_data.len() < 2 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let player_slot = instruction_data[1];
            join_game(accounts, player_slot)
        }
        2 => {
            if instruction_data.len() < 33 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let moves_hash: [u8; 32] = instruction_data[1..33].try_into().unwrap();
            submit_moves(accounts, moves_hash)
        }
        3 => {
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
            let salt = u64::from_le_bytes(instruction_data[6..14].try_into().unwrap());
            reveal_moves(accounts, moves, salt)
        }
        4 => claim_prize(accounts),
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
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

impl PlayerData {
    fn has_revealed(&self, round: u8) -> bool {
        self.moves_revealed[round as usize][0] != 0
    }

    fn get_move(&self, round: u8, index: usize) -> Option<Move> {
        match self.moves_revealed[round as usize][index] {
            0 => None,
            1 => Some(Move::Rock),
            2 => Some(Move::Paper),
            3 => Some(Move::Scissors),
            _ => None,
        }
    }

    fn set_moves(&mut self, round: u8, moves: &[Move; 5]) {
        for (i, &m) in moves.iter().enumerate() {
            self.moves_revealed[round as usize][i] = (m as u8) + 1;
        }
    }
}

fn create_move_hash(moves: &[Move; 5], salt: u64) -> [u8; 32] {
    let mut input = Vec::new();
    for &move_val in moves {
        input.push(move_val as u8);
    }
    input.extend_from_slice(&salt.to_le_bytes());

    let mut hash = [0u8; 32];
    for (i, &byte) in input.iter().enumerate() {
        let pos = i % 32;
        hash[pos] = hash[pos].wrapping_add(byte).wrapping_mul(7).wrapping_add(i as u8);
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

fn resolve_match(player1: &PlayerData, player2: &PlayerData, round: u8) -> Option<u8> {
    let mut p1_wins = 0;
    let mut p2_wins = 0;

    for i in 0..5 {
        if let (Some(m1), Some(m2)) = (player1.get_move(round, i), player2.get_move(round, i)) {
            match determine_winner(m1, m2) {
                Some(0) => p1_wins += 1,
                Some(1) => p2_wins += 1,
                _ => {}
            }
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

fn find_player_position_in_round(data: &[u8], player_idx: u8) -> Option<usize> {
    let round = get_current_round(data);
    (0..MAX_PLAYERS).find(|&pos| get_bracket_slot(data, round, pos) == player_idx)
}

fn get_opponent_position(my_position: usize) -> usize {
    if my_position % 2 == 0 {
        my_position + 1
    } else {
        my_position - 1
    }
}

fn calculate_total_rounds(max_players: u8) -> u8 {
    match max_players {
        2 => 1,
        4 => 2,
        8 => 3,
        16 => 4,
        32 => 5,
        64 => 6,
        _ => 0,
    }
}

fn calculate_matchups_in_round(round: u8, max_players: u8) -> u8 {
    let players_in_round = max_players >> round;
    players_in_round / 2
}

// ============================================================================
// Instruction Handlers
// ============================================================================

fn create_game(
    accounts: &[AccountInfo],
    max_players: u8,
    buy_in_lamports: u64,
    name: &[u8],
    description: &[u8],
) -> ProgramResult {
    let [creator, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if !game_account.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    if !matches!(max_players, 2 | 4 | 8 | 16 | 32 | 64) {
        msg!("Invalid max_players: must be 2, 4, 8, 16, 32, or 64");
        return Err(ProgramError::InvalidInstructionData);
    }

    let total_rounds = calculate_total_rounds(max_players);

    let mut data = game_account.try_borrow_mut_data()?;

    // Write metadata directly to bytes (no stack allocation!)
    set_creator(&mut data, creator.key());
    set_name(&mut data, name);
    set_description(&mut data, description);
    set_max_players(&mut data, max_players);
    set_state(&mut data, GameState::WaitingForPlayers);
    set_current_round(&mut data, 0);
    set_total_rounds(&mut data, total_rounds);
    set_matchups_resolved(&mut data, 0);
    set_buy_in(&mut data, buy_in_lamports);

    // Initialize bracket with 255 (empty)
    init_bracket(&mut data);

    // Auto-join creator as first player (slot 0)
    let creator_player = get_player_mut(&mut data, 0);
    creator_player.pubkey = *creator.key();
    creator_player.moves_committed = [0; 32];
    creator_player.moves_revealed = [[0; 5]; MAX_ROUNDS];
    creator_player.eliminated = 0;
    creator_player._padding = [0; 2];

    set_current_players(&mut data, 1); // Creator is first player
    set_prize_pool(&mut data, buy_in_lamports); // Creator's buy-in

    msg!("Game created: {} max players, {} lamports buy-in. Creator auto-joined as player 1/{}",
        max_players, buy_in_lamports, max_players);
    Ok(())
}

fn join_game(accounts: &[AccountInfo], player_slot: u8) -> ProgramResult {
    let [player, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;

    if get_state(&data) != GameState::WaitingForPlayers {
        msg!("Game not accepting players");
        return Err(ProgramError::InvalidInstructionData);
    }

    let current_players = get_current_players(&data);
    let max_players = get_max_players(&data);

    if current_players >= max_players {
        msg!("Game full");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Validate player_slot is within range
    if player_slot >= max_players {
        msg!("Invalid player slot: must be 0-{}", max_players - 1);
        return Err(ProgramError::InvalidInstructionData);
    }

    // Check if player has already joined ANY slot
    for i in 0..max_players {
        if get_player(&data, i).pubkey == *player.key() {
            msg!("Already joined");
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    // Check if requested slot is empty
    if get_player(&data, player_slot).pubkey != Pubkey::default() {
        msg!("Player slot already taken");
        return Err(ProgramError::InvalidInstructionData);
    }

    let buy_in = get_buy_in(&data);

    // NOTE: Client must send buy_in lamports via SystemProgram.transfer in the same transaction
    // The program cannot directly modify lamports of accounts it doesn't own

    // Add player to the requested slot
    let new_player = get_player_mut(&mut data, player_slot);
    new_player.pubkey = *player.key();
    new_player.moves_committed = [0; 32];
    new_player.moves_revealed = [[0; 5]; MAX_ROUNDS];
    new_player.eliminated = 0;
    new_player._padding = [0; 2];

    let new_player_count = current_players + 1;
    set_current_players(&mut data, new_player_count);

    let prize_pool = get_prize_pool(&data);
    set_prize_pool(&mut data, prize_pool + buy_in);

    // Auto-advance: if game is full, start it
    if new_player_count == max_players {
        set_state(&mut data, GameState::InProgress);

        // Set up initial bracket (round 0) - only add players who joined
        // Players are placed in bracket in the order of their slot numbers
        let mut bracket_pos = 0;
        for slot in 0..max_players {
            if get_player(&data, slot).pubkey != Pubkey::default() {
                set_bracket_slot(&mut data, 0, bracket_pos, slot);
                bracket_pos += 1;
            }
        }

        msg!("Game started! {} players", new_player_count);
    }

    msg!("Player joined: {}/{}", new_player_count, max_players);
    Ok(())
}

fn submit_moves(accounts: &[AccountInfo], moves_hash: [u8; 32]) -> ProgramResult {
    let [player, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;

    if get_state(&data) != GameState::InProgress {
        msg!("Game not in progress");
        return Err(ProgramError::InvalidInstructionData);
    }

    if moves_hash == [0u8; 32] {
        msg!("Invalid hash");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Find player (search all slots since players can be in any slot)
    let max_players = get_max_players(&data);
    let mut player_idx = None;
    for i in 0..max_players {
        if get_player(&data, i).pubkey == *player.key() {
            player_idx = Some(i);
            break;
        }
    }

    let player_idx = player_idx.ok_or(ProgramError::InvalidAccountData)?;
    let player_data = get_player(&data, player_idx);

    if player_data.eliminated != 0 {
        msg!("Player eliminated");
        return Err(ProgramError::InvalidInstructionData);
    }

    if player_data.moves_committed != [0u8; 32] {
        msg!("Already submitted");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Update the player's committed moves
    get_player_mut(&mut data, player_idx).moves_committed = moves_hash;

    msg!("Moves submitted for round {}", get_current_round(&data));
    Ok(())
}

fn reveal_moves(accounts: &[AccountInfo], moves: [Move; 5], salt: u64) -> ProgramResult {
    let [player, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut data = game_account.try_borrow_mut_data()?;

    if get_state(&data) != GameState::InProgress {
        msg!("Game not in progress");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Find player (search all slots since players can be in any slot)
    let max_players = get_max_players(&data);
    let mut player_idx = None;
    for i in 0..max_players {
        if get_player(&data, i).pubkey == *player.key() {
            player_idx = Some(i);
            break;
        }
    }

    let player_idx = player_idx.ok_or(ProgramError::InvalidAccountData)?;
    let current_round = get_current_round(&data);

    // Check player state
    {
        let player_data = get_player(&data, player_idx);
        if player_data.eliminated != 0 {
            msg!("Player eliminated");
            return Err(ProgramError::InvalidInstructionData);
        }

        if player_data.has_revealed(current_round) {
            msg!("Already revealed");
            return Err(ProgramError::InvalidInstructionData);
        }

        // Verify hash
        let computed_hash = create_move_hash(&moves, salt);
        if computed_hash != player_data.moves_committed {
            msg!("Hash mismatch");
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    // Store revealed moves
    get_player_mut(&mut data, player_idx).set_moves(current_round, &moves);

    // ATOMIC RESOLUTION: Find opponent and check if they revealed
    let my_position = find_player_position_in_round(&data, player_idx)
        .ok_or(ProgramError::InvalidAccountData)?;
    let opponent_position = get_opponent_position(my_position);
    let opponent_idx = get_bracket_slot(&data, current_round, opponent_position);

    let opponent_data = get_player(&data, opponent_idx);

    // Check if opponent has committed moves (can't reveal until both have committed)
    if opponent_data.moves_committed == [0u8; 32] {
        msg!("Opponent has not committed moves yet");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Check if opponent already revealed
    let opponent_has_revealed = opponent_data.has_revealed(current_round);

    if opponent_has_revealed {
        // Resolve matchup immediately!
        let winner = {
            let p1 = get_player(&data, player_idx);
            let p2 = get_player(&data, opponent_idx);
            resolve_match(p1, p2, current_round)
        };

        let (winner_idx, loser_idx) = if winner == Some(0) {
            (player_idx, opponent_idx)
        } else {
            (opponent_idx, player_idx)
        };

        get_player_mut(&mut data, loser_idx).eliminated = 1;
        let matchups_resolved = get_matchups_resolved(&data) + 1;
        set_matchups_resolved(&mut data, matchups_resolved);

        msg!("Match resolved: Player {} beats Player {}", winner_idx, loser_idx);

        // Check if all matchups in round are resolved
        let total_matchups = calculate_matchups_in_round(current_round, max_players);

        if matchups_resolved >= total_matchups {
            // Advance to next round
            let next_round = current_round + 1;
            set_current_round(&mut data, next_round);
            set_matchups_resolved(&mut data, 0);

            // Clear committed hashes for next round (preserve all revealed moves)
            for i in 0..max_players {
                if get_player(&data, i).eliminated == 0 {
                    get_player_mut(&mut data, i).moves_committed = [0; 32];
                }
            }

            let total_rounds = get_total_rounds(&data);
            if next_round >= total_rounds {
                // Game finished
                set_state(&mut data, GameState::Finished);
                msg!("Game finished! Winner: {:?}", get_player(&data, winner_idx).pubkey);
            } else {
                // Set up next round bracket (search all slots for non-eliminated players)
                let mut next_pos = 0;
                for i in 0..max_players {
                    if get_player(&data, i).eliminated == 0 && get_player(&data, i).pubkey != Pubkey::default() {
                        set_bracket_slot(&mut data, next_round, next_pos, i);
                        next_pos += 1;
                    }
                }

                msg!("Advanced to round {}", next_round);
            }
        }
    } else {
        msg!("Waiting for opponent to reveal");
    }

    Ok(())
}

fn claim_prize(accounts: &[AccountInfo]) -> ProgramResult {
    let [winner, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !winner.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let prize_pool = {
        let data = game_account.try_borrow_data()?;

        if get_state(&data) != GameState::Finished {
            msg!("Game not finished");
            return Err(ProgramError::InvalidInstructionData);
        }

        // Find winner (only non-eliminated player, search all slots)
        let max_players = get_max_players(&data);
        let mut winner_player = None;
        for i in 0..max_players {
            let player = get_player(&data, i);
            if player.pubkey != Pubkey::default() && player.eliminated == 0 {
                winner_player = Some(player);
                break;
            }
        }

        let winner_player = winner_player.ok_or(ProgramError::InvalidAccountData)?;

        if winner_player.pubkey != *winner.key() {
            msg!("Not the winner");
            return Err(ProgramError::InvalidAccountData);
        }

        get_prize_pool(&data)
    }; // data is dropped here

    // Prize distribution: 99% to winner, 1% platform fee (stays in game account)
    // TODO: Add platform fee withdrawal mechanism for game creator
    let winner_share = prize_pool
        .checked_mul(99)
        .and_then(|v| v.checked_div(100))
        .ok_or(ProgramError::InvalidAccountData)?;

    let platform_fee = prize_pool.checked_sub(winner_share)
        .ok_or(ProgramError::InvalidAccountData)?;

    msg!("Prize pool: {} lamports, Winner share (99%): {}, Platform fee (1%): {}",
        prize_pool, winner_share, platform_fee);

    // Transfer winner's share, accounting for rent-exempt minimum
    let mut winner_lamports = winner.try_borrow_mut_lamports()?;
    let mut game_lamports = game_account.try_borrow_mut_lamports()?;

    // Calculate rent-exempt minimum for this account (approx 6960 lamports per kilobyte for 2 years)
    // For 5048 bytes: ~35,134,080 lamports
    // Keep 1000 lamports as buffer to avoid account closure
    let rent_exempt_minimum = 1_000u64; // Small buffer to keep account alive

    // Available balance is total lamports minus rent-exempt minimum
    let available_balance = game_lamports.checked_sub(rent_exempt_minimum)
        .ok_or(ProgramError::InsufficientFunds)?;

    msg!("Account balance: {}, Rent-exempt minimum: {}, Available: {}",
        *game_lamports, rent_exempt_minimum, available_balance);

    // Transfer the lesser of winner_share or available_balance
    let transfer_amount = winner_share.min(available_balance);

    if transfer_amount < winner_share {
        msg!("Warning: Insufficient funds. Transferring {} instead of {}",
            transfer_amount, winner_share);
    }

    *game_lamports = game_lamports.checked_sub(transfer_amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    *winner_lamports = winner_lamports.checked_add(transfer_amount)
        .ok_or(ProgramError::InvalidAccountData)?;

    msg!("Prize claimed by winner: {} lamports (platform fee + rent-exempt reserve remains in account)",
        transfer_amount);

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests;
