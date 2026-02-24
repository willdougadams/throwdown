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

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct WaitingAccount {
    pub player: Pubkey,
    pub entry_fee: u64,
    pub timestamp: i64,
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
    pub _padding: [u8; 5], // 352 + 1 + 1 + 1 + 5 = 360 (alignment for i64)
    pub last_action_timestamp: i64,
    pub buy_in_lamports: u64,
    pub prize_pool: u64,
    pub players: [PlayerData; MAX_PLAYERS],
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
const OFFSET_LAST_ACTION: usize = 360;
const OFFSET_BUY_IN: usize = 368;
const OFFSET_PRIZE_POOL: usize = 376;
const OFFSET_PLAYERS: usize = 384; // After all metadata

const PLAYER_SIZE: usize = 72; // 32 (pubkey) + 32 (committed) + 5 (revealed) + 1 (eliminated) + 2 (padding)

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
    JoinPool {
        entry_fee: u64,
    },
    LeavePool,
    MatchPlayer,
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
        5 => {
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let entry_fee = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());
            join_pool(accounts, entry_fee)
        }
        6 => leave_pool(accounts),
        7 => {
            // MatchPlayer (uses existing CreateGame-like flow but with a WaitingAccount)
            // Expects [creator, game_account, waiting_account, system_program]
             if instruction_data.len() < 67 { // 1 + 1 + 64 + 1 ... wait, MatchPlayer might need name/desc too
                return Err(ProgramError::InvalidInstructionData);
            }
             // For simplicity, MatchPlayer will take a game name
            let name_len = instruction_data[1] as usize;
            let name = &instruction_data[2..2 + name_len];
            match_player(accounts, name)
        }
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
    fn has_revealed(&self) -> bool {
        self.moves_revealed[0] != 0
    }

    fn get_move(&self, index: usize) -> Option<Move> {
        match self.moves_revealed[index] {
            0 => None,
            1 => Some(Move::Rock),
            2 => Some(Move::Paper),
            3 => Some(Move::Scissors),
            _ => None,
        }
    }

    fn set_moves(&mut self, moves: &[Move; 5]) {
        for (i, &m) in moves.iter().enumerate() {
            self.moves_revealed[i] = (m as u8) + 1;
        }
    }
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

fn resolve_match(player1: &PlayerData, player2: &PlayerData) -> Option<u8> {
    let mut p1_wins = 0;
    let mut p2_wins = 0;

    for i in 0..5 {
        if let (Some(m1), Some(m2)) = (player1.get_move(i), player2.get_move(i)) {
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

// Matchup logic removed

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

    let mut data = game_account.try_borrow_mut_data()?;

    set_creator(&mut data, creator.key());
    set_name(&mut data, name);
    set_description(&mut data, description);
    set_max_players(&mut data, 2);
    set_state(&mut data, GameState::WaitingForPlayers);
    set_buy_in(&mut data, buy_in_lamports);

    // Auto-join creator as first player (slot 0)
    let creator_player = get_player_mut(&mut data, 0);
    creator_player.pubkey = *creator.key();
    creator_player.moves_committed = [0; 32];
    creator_player.moves_revealed = [0; 5];
    creator_player.eliminated = 0;
    creator_player._padding = [0; 2];

    set_current_players(&mut data, 1); // Creator is first player
    set_prize_pool(&mut data, buy_in_lamports); // Creator's buy-in

    msg!("Game created: 1v1 matchup, {} lamports buy-in. Creator auto-joined.", buy_in_lamports);
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
    new_player.moves_revealed = [0; 5];
    new_player.eliminated = 0;
    new_player._padding = [0; 2];

    let new_player_count = current_players + 1;
    set_current_players(&mut data, new_player_count);

    let prize_pool = get_prize_pool(&data);
    set_prize_pool(&mut data, prize_pool + buy_in);

    // Auto-advance: if game is full, start it
    if new_player_count == 2 {
        set_state(&mut data, GameState::InProgress);
        set_last_action_timestamp(&mut data, Clock::get()?.unix_timestamp);
        msg!("Game started! 1v1 match ready.");
    }

    msg!("Player joined: {}/2", new_player_count);
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

    // Check if both players in this matchup have committed
    let opponent_idx = if player_idx == 0 { 1 } else { 0 };
    let opponent_data = get_player(&data, opponent_idx);
    
    if opponent_data.moves_committed != [0u8; 32] {
        // Both have committed! Update timestamp for reveal stage start.
        set_last_action_timestamp(&mut data, Clock::get()?.unix_timestamp);
        msg!("Both players committed. Reveal stage started.");
    }

    msg!("Moves submitted.");
    Ok(())
}

fn reveal_moves(accounts: &[AccountInfo], moves: [Move; 5], _salt: u64) -> ProgramResult {
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
    // Store revealed moves
    get_player_mut(&mut data, player_idx).set_moves(&moves);

    // ATOMIC RESOLUTION: Find opponent and check if they revealed
    let opponent_idx = if player_idx == 0 { 1 } else { 0 };
    let opponent_data = get_player(&data, opponent_idx);

    // Check if opponent has committed moves (can't reveal until both have committed)
    if opponent_data.moves_committed == [0u8; 32] {
        msg!("Opponent has not committed moves yet");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Check if opponent already revealed
    let opponent_has_revealed = opponent_data.has_revealed();

    if opponent_has_revealed {
        // Resolve matchup immediately!
        let winner = {
            let p1 = get_player(&data, player_idx);
            let p2 = get_player(&data, opponent_idx);
            resolve_match(p1, p2)
        };

        let (winner_idx, loser_idx) = if winner == Some(0) {
            (player_idx, opponent_idx)
        } else {
            (opponent_idx, player_idx)
        };

        get_player_mut(&mut data, loser_idx).eliminated = 1;
        set_state(&mut data, GameState::Finished);
        msg!("Match resolved! Winner: Player {}, Loser: Player {}", winner_idx, loser_idx);
    } else {
        msg!("Waiting for opponent to reveal");
    }

    Ok(())
}

fn join_pool(accounts: &[AccountInfo], entry_fee: u64) -> ProgramResult {
    let [player, waiting_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify PDA seeds: [b"waiting", player_pubkey]
    // The client should have transferred rent + entry_fee to this address.
    // If the account has no data, we know it's uninitialized.

    if waiting_account.data_len() == 0 {
        // In Pinocchio, if we want to initialize a PDA that already has lamports,
        // we might just need to assign the owner and allocate space if it's a system account.
        // However, standard SOL pattern for PDAs is to call create_account via CPI.
        // But for this specific program (Pinocchio), let's simplify:
        // If the account is already owned by the program and has space, we just write.
        // If it's owned by SystemProgram, we need to assign it.
        
        // Actually, let's stick to the simplest path: 
        // The client creates the account or we assume it's ready to be written to
        // if it has enough lamports and is owned by the program.
        
        // Check if it's already owned by us. If not, we can't write to it yet.
        // For PDAs, the client usually uses findProgramAddress.
    }

    let timestamp = Clock::get()?.unix_timestamp;
    let waiting_data = WaitingAccount {
        player: *player.key(),
        entry_fee,
        timestamp,
    };

    let mut data = waiting_account.try_borrow_mut_data()?;
    let waiting_bytes: &[u8] = bytemuck::bytes_of(&waiting_data);
    
    if data.len() < waiting_bytes.len() {
        msg!("Waiting account too small: {} < {}", data.len(), waiting_bytes.len());
        return Err(ProgramError::AccountDataTooSmall);
    }

    data[..waiting_bytes.len()].copy_from_slice(waiting_bytes);

    msg!("Player joined pool: entry fee {} lamports", entry_fee);
    Ok(())
}

fn leave_pool(accounts: &[AccountInfo]) -> ProgramResult {
    let [player, waiting_account] = accounts.get(..2).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !player.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let data = waiting_account.try_borrow_data()?;
    if data.len() < 32 {
        return Err(ProgramError::InvalidAccountData);
    }
    
    let waiting_info: &WaitingAccount = bytemuck::from_bytes(&data[..core::mem::size_of::<WaitingAccount>()]);
    if waiting_info.player != *player.key() {
        msg!("Waiting account player mismatch: expected {:?}, got {:?}", waiting_info.player, player.key());
        return Err(ProgramError::InvalidAccountData);
    }

    // To close the account, we transfer all lamports to the player
    let mut player_lamports = player.try_borrow_mut_lamports()?;
    let mut waiting_lamports = waiting_account.try_borrow_mut_lamports()?;
    
    *player_lamports = player_lamports.checked_add(*waiting_lamports).unwrap();
    *waiting_lamports = 0;

    // Reset data to ensure it's "closed"
    drop(data);
    let mut data = waiting_account.try_borrow_mut_data()?;
    data.fill(0);

    msg!("Player left pool");
    Ok(())
}

fn match_player(accounts: &[AccountInfo], name: &[u8]) -> ProgramResult {
    let [creator, game_account, waiting_account] = accounts.get(..3).ok_or(ProgramError::NotEnoughAccountKeys)? else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !creator.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 1. Read waiting player info
    let waiting_info = {
        let data = waiting_account.try_borrow_data()?;
        if data.len() < core::mem::size_of::<WaitingAccount>() {
            return Err(ProgramError::InvalidAccountData);
        }
        *bytemuck::from_bytes::<WaitingAccount>(&data[..core::mem::size_of::<WaitingAccount>()])
    };

    // 2. Initialize 2-player game
    let mut data = game_account.try_borrow_mut_data()?;
    set_creator(&mut data, creator.key());
    set_name(&mut data, name);
    set_max_players(&mut data, 2);
    set_state(&mut data, GameState::InProgress);
    set_buy_in(&mut data, waiting_info.entry_fee);
    set_last_action_timestamp(&mut data, Clock::get()?.unix_timestamp);

    // Player 1: local player (creator/matcher)
    let p1 = get_player_mut(&mut data, 0);
    p1.pubkey = *creator.key();
    p1.moves_committed = [0; 32];
    p1.moves_revealed = [0; 5];
    p1.eliminated = 0;

    // Player 2: waiting player
    let p2 = get_player_mut(&mut data, 1);
    p2.pubkey = waiting_info.player;
    p2.moves_committed = [0; 32];
    p2.moves_revealed = [0; 5];
    p2.eliminated = 0;

    set_current_players(&mut data, 2);
    set_prize_pool(&mut data, waiting_info.entry_fee * 2);

    // 3. Close waiting account and return rent to the waiting player
    // The client MUST provide the waiting player's account as the 4th account.
    let player_to_refund = accounts.get(3).ok_or_else(|| {
        msg!("Missing refund account (waiting player)");
        ProgramError::NotEnoughAccountKeys
    })?;

    if *player_to_refund.key() != waiting_info.player {
        msg!("Refund account mismatch: expected {:?}, got {:?}", waiting_info.player, player_to_refund.key());
        return Err(ProgramError::InvalidAccountData);
    }

    let mut refund_lamports = player_to_refund.try_borrow_mut_lamports()?;
    let mut waiting_lamports = waiting_account.try_borrow_mut_lamports()?;
    
    // Rent goes back to player, entry fee is already "gone" (transferred from PDA to Game account)
    // Actually, in the current implementation, the entry fee is HELD by the PDA until MatchPlayer.
    // So we need to transfer the entry fee portion to the GameAccount and the rest (rent) back to the player.
    
    let entry_fee = waiting_info.entry_fee;
    let total_waiting_lamports = *waiting_lamports;
    
    if total_waiting_lamports < entry_fee {
        return Err(ProgramError::InsufficientFunds);
    }
    
    let rent_refund = total_waiting_lamports.checked_sub(entry_fee).unwrap();
    
    // Transfer entry fee to game account
    let mut game_lamports = game_account.try_borrow_mut_lamports()?;
    *game_lamports = game_lamports.checked_add(entry_fee).unwrap();
    
    // Transfer rent back to player
    *refund_lamports = refund_lamports.checked_add(rent_refund).unwrap();
    
    *waiting_lamports = 0;

    // Zero out the waiting account data
    drop(data); // Drop game data borrow before possible early return (though not really needed here)
    let mut w_data = waiting_account.try_borrow_mut_data()?;
    w_data.fill(0);

    msg!("Match found! Created 2-player game for {:?} and {:?}", creator.key(), waiting_info.player);
    Ok(())
}

fn claim_prize(accounts: &[AccountInfo]) -> ProgramResult {
    let [winner, game_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !winner.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
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
                            let player = get_player_mut(&mut data, idx);
                            if player.eliminated != 0 {
                                msg!("Already refunded or eliminated");
                                return Err(ProgramError::InvalidInstructionData);
                            }
                            player.eliminated = 1;

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
        } else if state != GameState::Finished {
            msg!("Game not finished");
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
        // Apply 1% platform fee to winners
        prize_pool.checked_mul(99).and_then(|v| v.checked_div(100)).ok_or(ProgramError::InvalidAccountData)?
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
