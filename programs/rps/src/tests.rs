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
    player1.set_moves(&[Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock]);
    player2.set_moves(&[Move::Scissors, Move::Scissors, Move::Scissors, Move::Scissors, Move::Scissors]);

    assert_eq!(resolve_match(&player1, &player2), Some(0));
}

#[test]
fn test_resolve_match_player2_wins_decisively() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // Player 2 wins all 5 rounds
    player1.set_moves(&[Move::Rock, Move::Rock, Move::Rock, Move::Rock, Move::Rock]);
    player2.set_moves(&[Move::Paper, Move::Paper, Move::Paper, Move::Paper, Move::Paper]);

    assert_eq!(resolve_match(&player1, &player2), Some(1));
}

#[test]
fn test_resolve_match_player1_wins_3_to_2() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // Player 1 wins 3, Player 2 wins 2
    player1.set_moves(&[Move::Rock, Move::Rock, Move::Rock, Move::Scissors, Move::Scissors]);
    player2.set_moves(&[Move::Scissors, Move::Scissors, Move::Scissors, Move::Rock, Move::Rock]);

    assert_eq!(resolve_match(&player1, &player2), Some(0));
}

#[test]
fn test_resolve_match_tie_goes_to_player1() {
    let mut player1 = PlayerData::zeroed();
    let mut player2 = PlayerData::zeroed();

    // All ties - tiebreaker should favor player 1
    player1.set_moves(&[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);
    player2.set_moves(&[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);

    assert_eq!(resolve_match(&player1, &player2), Some(0));
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
// PlayerData Tests
// ============================================================================

#[test]
fn test_player_set_and_get_moves() {
    let mut player = PlayerData::zeroed();
    let moves = [Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper];

    player.set_moves(&moves);

    assert_eq!(player.get_move(0), Some(Move::Rock));
    assert_eq!(player.get_move(1), Some(Move::Paper));
    assert_eq!(player.get_move(2), Some(Move::Scissors));
    assert_eq!(player.get_move(3), Some(Move::Rock));
    assert_eq!(player.get_move(4), Some(Move::Paper));
}

#[test]
fn test_player_has_revealed() {
    let mut player = PlayerData::zeroed();

    assert!(!player.has_revealed());

    player.set_moves(&[Move::Rock, Move::Paper, Move::Scissors, Move::Rock, Move::Paper]);

    assert!(player.has_revealed());
}
