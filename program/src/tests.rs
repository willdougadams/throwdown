use super::*;

// ============================================================================
// RPS Game Logic Tests
// ============================================================================

#[test]
fn test_determine_winner_rock_beats_scissors() {
    assert_eq!(determine_winner(Move::Rock, Move::Scissors), Some(0));
}

#[test]
fn test_determine_winner_scissors_beats_paper() {
    assert_eq!(determine_winner(Move::Scissors, Move::Paper), Some(0));
}

#[test]
fn test_determine_winner_paper_beats_rock() {
    assert_eq!(determine_winner(Move::Paper, Move::Rock), Some(0));
}

#[test]
fn test_determine_winner_scissors_loses_to_rock() {
    assert_eq!(determine_winner(Move::Scissors, Move::Rock), Some(1));
}

#[test]
fn test_determine_winner_paper_loses_to_scissors() {
    assert_eq!(determine_winner(Move::Paper, Move::Scissors), Some(1));
}

#[test]
fn test_determine_winner_rock_loses_to_paper() {
    assert_eq!(determine_winner(Move::Rock, Move::Paper), Some(1));
}

#[test]
fn test_determine_winner_tie_rock() {
    assert_eq!(determine_winner(Move::Rock, Move::Rock), None);
}

#[test]
fn test_determine_winner_tie_paper() {
    assert_eq!(determine_winner(Move::Paper, Move::Paper), None);
}

#[test]
fn test_determine_winner_tie_scissors() {
    assert_eq!(determine_winner(Move::Scissors, Move::Scissors), None);
}

// ============================================================================
// Match Resolution Tests (Best of 5)
// ============================================================================

#[test]
fn test_resolve_match_player1_wins_decisively() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // Player 1 wins all 5 rounds
    player1.set_moves(0, &[Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock]);
    player2.set_moves(0, &[Move::Scissors, Move::Scissors, Move::Scissors, Move::Scissors, Move::Scissors]);

    assert_eq!(resolve_match(&player1, &player2, 0), Some(0));
}

#[test]
fn test_resolve_match_player2_wins_decisively() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // Player 2 wins all 5 rounds
    player1.set_moves(0, &[Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock]);
    player2.set_moves(0, &[Move::Paper, Move::Paper, Move::Paper, Move::Paper, Move::Paper]);

    assert_eq!(resolve_match(&player1, &player2, 0), Some(1));
}

#[test]
fn test_resolve_match_player1_wins_3_to_2() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // Player 1 wins 3, Player 2 wins 2
    player1.set_moves(0, &[Move::Rock, Move::Rock, Move::Rock, Move::Scissors, Move::Scissors]);
    player2.set_moves(0, &[Move::Scissors, Move::Scissors, Move::Scissors, Move::Rock, Move::Rock]);

    assert_eq!(resolve_match(&player1, &player2, 0), Some(0));
}

#[test]
fn test_resolve_match_tie_goes_to_player1() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // All ties - tiebreaker should favor player 1
    player1.set_moves(0, &[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);
    player2.set_moves(0, &[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);

    assert_eq!(resolve_match(&player1, &player2, 0), Some(0));
}

#[test]
fn test_resolve_match_with_mixed_results() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // P1 wins 2, P2 wins 2, 1 tie -> P2 wins 2-2 becomes 2-2, tiebreaker to P1
    player1.set_moves(0, &[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Rock]);
    player2.set_moves(0, &[Move::Scissors, Move::Scissors, Move::Rock, Move::Rock, Move::Paper]);

    let result = resolve_match(&player1, &player2, 0);
    assert!(result.is_some());
}

// ============================================================================
// Hash Function Tests
// ============================================================================

#[test]
fn test_create_move_hash_deterministic() {
    let moves = [Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper];
    let salt = 12345u64;

    let hash1 = create_move_hash(&moves, salt);
    let hash2 = create_move_hash(&moves, salt);

    assert_eq!(hash1, hash2);
}

#[test]
fn test_create_move_hash_different_moves() {
    let moves1 = [Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper];
    let moves2 = [Move::Paper, Move::Rock, Move::Scissors, Move::Rock, Move::Paper];
    let salt = 12345u64;

    let hash1 = create_move_hash(&moves1, salt);
    let hash2 = create_move_hash(&moves2, salt);

    assert_ne!(hash1, hash2);
}

#[test]
fn test_create_move_hash_different_salt() {
    let moves = [Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper];
    let salt1 = 12345u64;
    let salt2 = 54321u64;

    let hash1 = create_move_hash(&moves, salt1);
    let hash2 = create_move_hash(&moves, salt2);

    assert_ne!(hash1, hash2);
}

#[test]
fn test_create_move_hash_not_all_zeros() {
    let moves = [Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock];
    let salt = 0u64;

    let hash = create_move_hash(&moves, salt);

    // Even with all zeros input, hash should not be all zeros
    assert!(hash.iter().any(|&b| b != 0));
}

// ============================================================================
// Tournament Bracket Calculation Tests
// ============================================================================

#[test]
fn test_calculate_total_rounds_2_players() {
    assert_eq!(calculate_total_rounds(2), 1);
}

#[test]
fn test_calculate_total_rounds_4_players() {
    assert_eq!(calculate_total_rounds(4), 2);
}

#[test]
fn test_calculate_total_rounds_8_players() {
    assert_eq!(calculate_total_rounds(8), 3);
}

#[test]
fn test_calculate_total_rounds_16_players() {
    assert_eq!(calculate_total_rounds(16), 4);
}

#[test]
fn test_calculate_total_rounds_32_players() {
    assert_eq!(calculate_total_rounds(32), 5);
}

#[test]
fn test_calculate_total_rounds_64_players() {
    assert_eq!(calculate_total_rounds(64), 6);
}

#[test]
fn test_calculate_total_rounds_invalid() {
    assert_eq!(calculate_total_rounds(3), 0);
    assert_eq!(calculate_total_rounds(5), 0);
    assert_eq!(calculate_total_rounds(7), 0);
}

#[test]
fn test_calculate_matchups_in_round_0() {
    // Round 0 with 8 players = 4 matchups
    assert_eq!(calculate_matchups_in_round(0, 8), 4);
}

#[test]
fn test_calculate_matchups_in_round_1() {
    // Round 1 with 8 players = 2 matchups (4 players left)
    assert_eq!(calculate_matchups_in_round(1, 8), 2);
}

#[test]
fn test_calculate_matchups_in_round_2() {
    // Round 2 with 8 players = 1 matchup (2 players left - finals)
    assert_eq!(calculate_matchups_in_round(2, 8), 1);
}

#[test]
fn test_calculate_matchups_64_player_tournament() {
    assert_eq!(calculate_matchups_in_round(0, 64), 32); // Round of 64
    assert_eq!(calculate_matchups_in_round(1, 64), 16); // Round of 32
    assert_eq!(calculate_matchups_in_round(2, 64), 8);  // Round of 16
    assert_eq!(calculate_matchups_in_round(3, 64), 4);  // Quarterfinals
    assert_eq!(calculate_matchups_in_round(4, 64), 2);  // Semifinals
    assert_eq!(calculate_matchups_in_round(5, 64), 1);  // Finals
}

// ============================================================================
// Opponent Pairing Logic Tests
// ============================================================================

#[test]
fn test_get_opponent_position_even() {
    assert_eq!(get_opponent_position(0), 1);
    assert_eq!(get_opponent_position(2), 3);
    assert_eq!(get_opponent_position(4), 5);
    assert_eq!(get_opponent_position(10), 11);
}

#[test]
fn test_get_opponent_position_odd() {
    assert_eq!(get_opponent_position(1), 0);
    assert_eq!(get_opponent_position(3), 2);
    assert_eq!(get_opponent_position(5), 4);
    assert_eq!(get_opponent_position(11), 10);
}

#[test]
fn test_get_opponent_position_reciprocal() {
    // Opponent relationship should be symmetric
    for i in 0..32 {
        let opponent = get_opponent_position(i);
        assert_eq!(get_opponent_position(opponent), i);
    }
}

// ============================================================================
// PlayerData Tests
// ============================================================================

#[test]
fn test_player_set_and_get_moves() {
    let mut player = PlayerData::zeroed();
    let moves = [Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper];

    player.set_moves(0, &moves);

    assert_eq!(player.get_move(0, 0), Some(Move::Rock));
    assert_eq!(player.get_move(0, 1), Some(Move::Paper));
    assert_eq!(player.get_move(0, 2), Some(Move::Scissors));
    assert_eq!(player.get_move(0, 3), Some(Move::Rock));
    assert_eq!(player.get_move(0, 4), Some(Move::Paper));
}

#[test]
fn test_player_has_revealed() {
    let mut player = PlayerData::zeroed();

    assert!(!player.has_revealed(0));

    player.set_moves(0, &[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);

    assert!(player.has_revealed(0));
}

#[test]
fn test_player_moves_different_rounds() {
    let mut player = PlayerData::zeroed();

    let round0_moves = [Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock];
    let round1_moves = [Move::Paper, Move::Paper, Move::Paper, Move::Paper, Move::Paper];

    player.set_moves(0, &round0_moves);
    player.set_moves(1, &round1_moves);

    assert_eq!(player.get_move(0, 0), Some(Move::Rock));
    assert_eq!(player.get_move(1, 0), Some(Move::Paper));
}
