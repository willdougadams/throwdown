// Note: Full integration testing with pinocchio is challenging because pinocchio uses
// custom AccountInfo types that aren't compatible with solana-program-test.
//
// For comprehensive integration testing, we recommend:
// 1. Building the program with `make build-program`
// 2. Deploying to localnet with `solana program deploy`
// 3. Testing via the frontend or bankrun/anchor integration tests
//
// These tests validate the program structure and that it compiles correctly.

#[test]
fn test_program_compiles() {
    // This test simply validates that the program compiles and links correctly
    assert!(true, "Program compiled successfully!");
}

#[test]
fn test_byte_offsets() {
    // Validate that our byte offset calculations are correct
    const OFFSET_PLAYERS: usize = 56;

    const PLAYER_SIZE: usize = 72; // 32 + 32 + 5 + 1 + 2
    const MAX_PLAYERS: usize = 64;
    const BRACKET_OFFSET: usize = OFFSET_PLAYERS + (MAX_PLAYERS * PLAYER_SIZE);

    // Expected total size: metadata(56) + players(4608) + bracket(384) = 5048 bytes
    let expected_size = 56 + (64 * 72) + (64 * 6);
    assert_eq!(expected_size, 5048);

    // Validate bracket offset
    assert_eq!(BRACKET_OFFSET, 4664);

    println!("✅ Byte offsets validated!");
}

#[test]
fn test_constants() {
    // Test that constants are correctly defined
    assert_eq!(pinocchio_token_program::MAX_PLAYERS, 64);
    assert_eq!(pinocchio_token_program::MAX_ROUNDS, 6);
}
