use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use borsh::{BorshDeserialize, BorshSerialize};
use great_banyan::{process_instruction, BanyanInstruction, TreeState, Bud, GameManager};

// Bridge between solana-program and pinocchio types for testing
pub fn process_instruction_bridge(
    program_id: &Pubkey,
    accounts: &[solana_program::account_info::AccountInfo],
    instruction_data: &[u8],
) -> solana_program::entrypoint::ProgramResult {
    unsafe {
        let pinocchio_program_id = &*(program_id as *const _ as *const pinocchio::pubkey::Pubkey);
        let pinocchio_accounts = &*(accounts as *const _ as *const [great_banyan::AccountInfo]);
        match process_instruction(pinocchio_program_id, pinocchio_accounts, instruction_data) {
            Ok(_) => Ok(()),
            Err(_) => Err(solana_program::program_error::ProgramError::Custom(999)),
        }
    }
}

#[tokio::test]
async fn test_initialize_game() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "great_banyan",
        program_id,
        processor!(process_instruction_bridge),
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let (manager_pda, _) = Pubkey::find_program_address(&[b"manager"], &program_id);

    let mut transaction = Transaction::new_with_payer(
        &[Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(manager_pda, false),
                AccountMeta::new_readonly(payer.pubkey(), false),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
            data: borsh::to_vec(&BanyanInstruction::InitializeGame).unwrap(),
        }],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);

    banks_client.process_transaction(transaction).await.unwrap();

    let manager_account = banks_client.get_account(manager_pda).await.unwrap().unwrap();
    let manager: GameManager = GameManager::try_from_slice(&manager_account.data).unwrap();
    assert_eq!(manager.authority, payer.pubkey().to_bytes());
}

#[tokio::test]
async fn test_initialize_tree() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "great_banyan",
        program_id,
        processor!(process_instruction_bridge),
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let (manager_pda, _) = Pubkey::find_program_address(&[b"manager"], &program_id);
    let (tree_pda, _) = Pubkey::find_program_address(&[b"tree", payer.pubkey().as_ref()], &program_id);

    let mut transaction = Transaction::new_with_payer(
        &[
            Instruction {
                program_id,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(manager_pda, false),
                    AccountMeta::new_readonly(payer.pubkey(), false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
                data: borsh::to_vec(&BanyanInstruction::InitializeGame).unwrap(),
            },
            Instruction {
                program_id,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(tree_pda, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
                data: borsh::to_vec(&BanyanInstruction::InitializeTree {
                    fruit_frequency: 100,
                    vitality_required_base: 1000,
                }).unwrap(),
            },
        ],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);

    banks_client.process_transaction(transaction).await.unwrap();

    let tree_account = banks_client.get_account(tree_pda).await.unwrap().unwrap();
    let tree: TreeState = TreeState::try_from_slice(&tree_account.data).unwrap();
    assert_eq!(tree.fruit_frequency, 100);
}
