// #![cfg(feature = "test-bpf")]

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
    // sysvar::{clock::Clock, rent::Rent},
};
use solana_program::keccak;
use solana_program_test::*;
use solana_sdk::{
    signature::{Keypair, Signer},
    transaction::Transaction,
};

// Re-define structs/enums since we might not be able to import easily from cdylib or if types mismatch
// Actually, if we use the crate, we get the [u8; 32] version.
use great_banyan::{BanyanInstruction, TreeState, Bud, GameManager};

#[tokio::test]
async fn test_initialize_tree() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "great_banyan",
        program_id,
        processor!(great_banyan::process_instruction_test),
    );
    
    let authority = Keypair::new();
    program_test.add_account(
        authority.pubkey(),
        solana_sdk::account::Account {
            lamports: 1_000_000_000,
            ..solana_sdk::account::Account::default()
        },
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // 1. Initialize Game Manager
    let (manager_pda, _) = Pubkey::find_program_address(&[b"manager"], &program_id);
    
    let init_game_ix = BanyanInstruction::InitializeGame;
    let init_game_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_game_ix).unwrap(),
    };
    
    let mut transaction = Transaction::new_with_payer(
        &[init_game_instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();
    
    // Verify Manager
    let manager_account = banks_client.get_account(manager_pda).await.unwrap().unwrap();
    let manager_state = GameManager::try_from_slice(&manager_account.data).unwrap();
    assert_eq!(manager_state.current_epoch, 0);

    // 2. Initialize Tree (Epoch 0)
    let epoch_bytes = 0u64.to_le_bytes();
    let (tree_pda, _) = Pubkey::find_program_address(&[b"tree", &epoch_bytes], &program_id);
    let (root_bud_pda, _) = Pubkey::find_program_address(&[b"bud", tree_pda.as_ref(), b"root"], &program_id);

    // Instruction Data
    let fruit_frequency = 256; 
    let vitality_required = 100;

    let init_ix = BanyanInstruction::InitializeTree {
        fruit_frequency,
        vitality_required_base: vitality_required,
    };

    let instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false), // Manager needed for epoch check
            AccountMeta::new(tree_pda, false),
            AccountMeta::new(root_bud_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_ix).unwrap(),
    };

    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);

    banks_client.process_transaction(transaction).await.unwrap();

    // Verify State
    let tree_account = banks_client.get_account(tree_pda).await.unwrap().unwrap();
    // Use deserialize to be safe against padding or extra bytes
    let mut tree_data_slice = &tree_account.data[..];
    let tree_state = TreeState::deserialize(&mut tree_data_slice).unwrap();
    assert_eq!(tree_state.fruit_frequency, fruit_frequency);
    assert_eq!(tree_state.authority, payer.pubkey().to_bytes());

    let bud_account = banks_client.get_account(root_bud_pda).await.unwrap().unwrap();
    let bud_state = bytemuck::from_bytes::<Bud>(&bud_account.data[..std::mem::size_of::<Bud>()]);
    assert_eq!(bud_state.vitality_required, vitality_required);
    assert_eq!(bud_state.depth, 0);
}

#[tokio::test]
async fn test_nurture_bud() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "great_banyan",
        program_id,
        processor!(great_banyan::process_instruction_test),
    );
     // Start
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // 1. Initialize Game
    let (manager_pda, _) = Pubkey::find_program_address(&[b"manager"], &program_id);
    let init_game_ix = BanyanInstruction::InitializeGame;
    let init_game_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_game_ix).unwrap(),
    };
    let mut tx = Transaction::new_with_payer(&[init_game_instruction], Some(&payer.pubkey()));
    tx.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(tx).await.unwrap();

    // 2. Initialize Tree
    let epoch_bytes = 0u64.to_le_bytes();
    let (tree_pda, _) = Pubkey::find_program_address(&[b"tree", &epoch_bytes], &program_id);
    let (root_bud_pda, _) = Pubkey::find_program_address(&[b"bud", tree_pda.as_ref(), b"root"], &program_id);

    let init_ix = BanyanInstruction::InitializeTree {
        fruit_frequency: 256,
        vitality_required_base: 100,
    };
     let init_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false),
            AccountMeta::new(tree_pda, false),
            AccountMeta::new(root_bud_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_ix).unwrap(),
    };
    
    let mut tx = Transaction::new_with_payer(&[init_instruction], Some(&payer.pubkey()));
    tx.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(tx).await.unwrap();

    // 3. Nurture
    let nurture_ix = BanyanInstruction::NurtureBud {
        essence: "AGTC".to_string(),
        nonce: 0,
        mined_slot: 0,
    };
    let nurture_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false), // Update Manager prize pool
            AccountMeta::new(root_bud_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&nurture_ix).unwrap(),
    };
    
    let mut tx = Transaction::new_with_payer(&[nurture_instruction], Some(&payer.pubkey()));
    tx.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(tx).await.unwrap();

    // Verify
    let manager_account = banks_client.get_account(manager_pda).await.unwrap().unwrap();
    let manager_state = GameManager::try_from_slice(&manager_account.data).unwrap();
    assert_eq!(manager_state.prize_pool, 600_000); // 0.0006 SOL

    let bud_account = banks_client.get_account(root_bud_pda).await.unwrap().unwrap();
    let bud_state = bytemuck::from_bytes::<Bud>(&bud_account.data[..std::mem::size_of::<Bud>()]);
    assert!(bud_state.vitality_current > 0);
    assert_eq!(bud_state.contribution_count, 1);
    assert_eq!(bud_state.contributions[0].key, payer.pubkey().to_bytes());
}

#[tokio::test]
async fn test_bloom_bud_win() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "great_banyan",
        program_id,
        processor!(great_banyan::process_instruction_test),
    );
     // Start
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    // 1. Initialize Game
    let (manager_pda, _) = Pubkey::find_program_address(&[b"manager"], &program_id);
    let init_game_ix = BanyanInstruction::InitializeGame;
    let init_game_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_game_ix).unwrap(),
    };
    let mut tx = Transaction::new_with_payer(&[init_game_instruction], Some(&payer.pubkey()));
    tx.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(tx).await.unwrap();

    // 2. Initialize Tree
    let epoch_bytes = 0u64.to_le_bytes();
    let (tree_pda, _) = Pubkey::find_program_address(&[b"tree", &epoch_bytes], &program_id);
    let (root_bud_pda, _) = Pubkey::find_program_address(&[b"bud", tree_pda.as_ref(), b"root"], &program_id);
    
    // Use fruit_frequency = 1 to guarantee a win on first bloom
    let init_ix = BanyanInstruction::InitializeTree {
        fruit_frequency: 1,
        vitality_required_base: 10, // Low req for testing
    };
    let init_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(manager_pda, false),
            AccountMeta::new(tree_pda, false),
            AccountMeta::new(root_bud_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: borsh::to_vec(&init_ix).unwrap(),
    };
    let mut tx = Transaction::new_with_payer(&[init_instruction], Some(&payer.pubkey()));
    tx.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(tx).await.unwrap();

    // 3. Nurture until vitality met
    // Dummy children PDAs (needed for instruction when optional accounts are passed)
    let (left_child_pda, _) = Pubkey::find_program_address(&[b"bud", root_bud_pda.as_ref(), b"left"], &program_id);
    let (right_child_pda, _) = Pubkey::find_program_address(&[b"bud", root_bud_pda.as_ref(), b"right"], &program_id);

    for i in 0..10 {
         let nurture_ix = BanyanInstruction::NurtureBud { 
             essence: format!("AGTC-{}", i),
             nonce: i as u64,
             mined_slot: 0,
         };
         
         // We can always pass the extra accounts, or only pass them when we expect to bloom.
         // Passing them always is safer/simpler for client logic mostly.
         // But here let's pass them to verify it works.
         
         let nurture_instruction = Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(manager_pda, false),
                AccountMeta::new(root_bud_pda, false),
                AccountMeta::new_readonly(system_program::id(), false),
                // Extra accounts for auto-bloom
                AccountMeta::new_readonly(tree_pda, false),
                AccountMeta::new(left_child_pda, false),
                AccountMeta::new(right_child_pda, false),
            ],
            data: borsh::to_vec(&nurture_ix).unwrap(),
        };
        let mut tx = Transaction::new_with_payer(&[nurture_instruction], Some(&payer.pubkey()));
        tx.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(tx).await.unwrap();
    }
    
    // Check prize pool > 0 and Vitality
    // Wait, if it auto-bloomed on the last one, the prize pool should be EMPTY (0) because it was paid out!
    // And bud should be bloomed.

    let bud_account = banks_client.get_account(root_bud_pda).await.unwrap().unwrap();
    let bud_state = bytemuck::from_bytes::<Bud>(&bud_account.data[..std::mem::size_of::<Bud>()]);
    
    assert!(bud_state.vitality_current >= bud_state.vitality_required);
    assert!(bud_state.is_bloomed != 0);
    assert!(bud_state.is_fruit != 0); // Should be fruit because fruit_frequency = 1
    
    // Verify Manager Reset
    let manager_account = banks_client.get_account(manager_pda).await.unwrap().unwrap();
    let manager_state = GameManager::try_from_slice(&manager_account.data).unwrap();
    assert_eq!(manager_state.current_epoch, 1);
    assert_eq!(manager_state.prize_pool, 0);
}
