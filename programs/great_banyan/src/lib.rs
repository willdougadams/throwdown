use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    instruction::{AccountMeta, Instruction},
    msg,
    program_error::ProgramError,
    pubkey::Pubkey, // [u8; 32]
    sysvars::{clock::Clock, rent::Rent, Sysvar},
};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::keccak;
use solana_program::pubkey::Pubkey as SolPubkey;

// Use standard Result for ProgramResult
pub type ProgramResult = Result<(), ProgramError>;

// --- State Definitions ---

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TreeState {
    pub root: [u8; 32],
    pub max_depth: u8,
    pub total_pot: u64, // 8 bytes
    pub authority: [u8; 32],
    pub vitality_required_base: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Bud {
    pub parent: [u8; 32],
    pub depth: u8,
    pub vitality_current: u64,
    pub vitality_required: u64,
    pub is_bloomed: bool,
    pub is_fruit: bool,
    pub nurturers: Vec<[u8; 32]>,
}

// Fixed size for Bud to avoid realloc complexity in Pinocchio
const BUD_SIZE: usize = 1024; 

// --- Instruction Definition ---

#[derive(BorshSerialize, BorshDeserialize)]
pub enum BanyanInstruction {
    InitializeTree {
        root: [u8; 32],
        max_depth: u8,
        vitality_required_base: u64,
    },
    NurtureBud {
        essence: String,
    },
    BloomBud {
        proof: Vec<[u8; 32]>,
    },
}

// --- Logic ---

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = BanyanInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let account_iter = &mut accounts.iter();

    match instruction {
        BanyanInstruction::InitializeTree {
            root,
            max_depth,
            vitality_required_base,
        } => {
            let payer = next_account_info(account_iter)?;
            let tree_state_info = next_account_info(account_iter)?;
            let root_bud_info = next_account_info(account_iter)?;
            let system_program = next_account_info(account_iter)?;

            if !payer.is_signer() {
                return Err(ProgramError::MissingRequiredSignature);
            }

            // Create TreeState
            let tree_seeds: &[&[u8]] = &[b"tree", payer.key()];
            let (tree_pda, tree_bump) = find_pda(tree_seeds, program_id);
            if tree_pda != *tree_state_info.key() {
                return Err(ProgramError::InvalidSeeds);
            }

            let tree_state = TreeState {
                root,
                max_depth,
                total_pot: 0,
                authority: *payer.key(),
                vitality_required_base,
            };
            let tree_data = borsh::to_vec(&tree_state).map_err(|_| ProgramError::InvalidInstructionData)?;
            
            create_account(
                payer,
                tree_state_info,
                system_program,
                program_id,
                &tree_data,
                &[b"tree", payer.key(), &[tree_bump]],
            )?;

            // Create Root Bud
            let bud_seeds: &[&[u8]] = &[b"bud", tree_state_info.key(), b"root"];
            let (bud_pda, bud_bump) = find_pda(bud_seeds, program_id);
             if bud_pda != *root_bud_info.key() {
                return Err(ProgramError::InvalidSeeds);
            }

            let root_bud = Bud {
                parent: [0u8; 32],
                depth: 0,
                vitality_current: 0,
                vitality_required: vitality_required_base,
                is_bloomed: false,
                is_fruit: false,
                nurturers: Vec::new(),
            };
            let bud_data = borsh::to_vec(&root_bud).map_err(|_| ProgramError::InvalidInstructionData)?;

            create_account_with_space(
                payer,
                root_bud_info,
                system_program,
                program_id,
                &bud_data,
                BUD_SIZE,
                &[b"bud", tree_state_info.key(), b"root", &[bud_bump]],
            )?;
            
            Ok(())
        }

        BanyanInstruction::NurtureBud { essence } => {
            let nurturer = next_account_info(account_iter)?;
            let tree_state_info = next_account_info(account_iter)?; // Update pot
            let bud_info = next_account_info(account_iter)?;
            let system_program = next_account_info(account_iter)?;

             if !nurturer.is_signer() {
                return Err(ProgramError::MissingRequiredSignature);
            }

            // 1. Transfer
            let transfer_amount = 600_000;
            invoke_transfer(
                nurturer,
                tree_state_info,
                system_program,
                transfer_amount,
            )?;

            // Update Tree Pot
            let mut tree_state = TreeState::try_from_slice(&tree_state_info.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
            tree_state.total_pot += transfer_amount;
            
            let serialized_tree = borsh::to_vec(&tree_state).map_err(|_| ProgramError::InvalidInstructionData)?;
            tree_state_info.try_borrow_mut_data()?[..serialized_tree.len()].copy_from_slice(&serialized_tree);
             

            // 2. Vitality Hash 
            let clock = Clock::get()?;
            let slot = clock.slot;
             
            let mut input = Vec::new();
            input.extend_from_slice(essence.as_bytes());
            input.extend_from_slice(bud_info.key());
            input.extend_from_slice(nurturer.key());
            input.extend_from_slice(&slot.to_le_bytes());

            let hash_result = keccak::hash(&input);
            let first_byte = hash_result.0[0];
            let is_strong = (first_byte & 0xF0) == 0; 
            let vitality_gain = if is_strong { 10 } else { 1 };
            
            // Update Bud
            let mut bud = Bud::try_from_slice(&bud_info.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
            bud.vitality_current += vitality_gain;
            bud.nurturers.push(*nurturer.key());
            
            let new_data = borsh::to_vec(&bud).map_err(|_| ProgramError::InvalidInstructionData)?;
            if new_data.len() > bud_info.data_len() {
                 return Err(ProgramError::AccountDataTooSmall); 
            }
             
            bud_info.try_borrow_mut_data()?[..new_data.len()].copy_from_slice(&new_data);

            Ok(())
        }

        BanyanInstruction::BloomBud { proof } => {
            let payer = next_account_info(account_iter)?;
            let tree_state_info = next_account_info(account_iter)?;
            let bud_info = next_account_info(account_iter)?;
            let left_child_info = next_account_info(account_iter)?;
            let right_child_info = next_account_info(account_iter)?;
            let system_program = next_account_info(account_iter)?;
            
            let tree_state = TreeState::try_from_slice(&tree_state_info.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
            let mut bud = Bud::try_from_slice(&bud_info.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
            
             if bud.vitality_current < bud.vitality_required {
                return Err(ProgramError::Custom(0));
            }
            if bud.is_bloomed {
                 return Err(ProgramError::AccountAlreadyInitialized);
            }
            if bud.depth >= tree_state.max_depth {
                 return Err(ProgramError::Custom(1));
            }
            
            // Merkle Verification
            let leaf = keccak::hash(bud_info.key());
            if verify_merkle_proof(&proof, tree_state.root, leaf.0) {
                 bud.is_fruit = true;
            }
            bud.is_bloomed = true;
            
            let new_bud_data = borsh::to_vec(&bud).map_err(|_| ProgramError::InvalidInstructionData)?;
            bud_info.try_borrow_mut_data()?[..new_bud_data.len()].copy_from_slice(&new_bud_data);
            
            // Initialize Children
            let child_depth = bud.depth + 1;
            let child_vitality_req = bud.vitality_required + 50;
            
            // Left Child
            let left_seeds: &[&[u8]] = &[b"bud", bud_info.key(), b"left"];
            let (left_pda, left_bump) = find_pda(left_seeds, program_id);
            if left_pda != *left_child_info.key() {
                 return Err(ProgramError::InvalidSeeds);
            }
            
            let left_child = Bud {
                parent: *bud_info.key(),
                depth: child_depth,
                vitality_current: 0,
                vitality_required: child_vitality_req,
                is_bloomed: false,
                is_fruit: false,
                nurturers: Vec::new(),
            };
            
            create_account_with_space(
                payer,
                left_child_info,
                system_program,
                program_id,
                &borsh::to_vec(&left_child).unwrap(),
                BUD_SIZE,
                &[b"bud", bud_info.key(), b"left", &[left_bump]],
            )?;

             // Right Child
            let right_seeds: &[&[u8]] = &[b"bud", bud_info.key(), b"right"];
            let (right_pda, right_bump) = find_pda(right_seeds, program_id);
            if right_pda != *right_child_info.key() {
                 return Err(ProgramError::InvalidSeeds);
            }
            
            let right_child = Bud {
                parent: *bud_info.key(),
                depth: child_depth,
                vitality_current: 0,
                vitality_required: child_vitality_req,
                is_bloomed: false,
                is_fruit: false,
                nurturers: Vec::new(),
            };
            
            create_account_with_space(
                payer,
                right_child_info,
                system_program,
                program_id,
                &borsh::to_vec(&right_child).unwrap(),
                BUD_SIZE,
                &[b"bud", bud_info.key(), b"right", &[right_bump]],
            )?;
            
            Ok(())
        }
    }
}

// --- Helpers ---

fn next_account_info<'a, I>(iter: &mut I) -> Result<&'a AccountInfo, ProgramError>
where
    I: Iterator<Item = &'a AccountInfo>,
{
    iter.next().ok_or(ProgramError::NotEnoughAccountKeys)
}

fn find_pda(seeds: &[&[u8]], program_id: &Pubkey) -> ([u8; 32], u8) {
    let sol_program_id = SolPubkey::new_from_array(*program_id);
    let (pda, bump) = SolPubkey::find_program_address(seeds, &sol_program_id);
    (pda.to_bytes(), bump)
}

fn create_account(
    payer: &AccountInfo,
    new_account: &AccountInfo,
    system_program: &AccountInfo,
    program_id: &Pubkey,
    data: &[u8],
    seeds: &[&[u8]],
) -> ProgramResult {
    create_account_with_space(payer, new_account, system_program, program_id, data, data.len(), seeds)
}

fn create_account_with_space(
    payer: &AccountInfo,
    new_account: &AccountInfo,
    system_program: &AccountInfo,
    program_id: &Pubkey,
    init_data: &[u8],
    space: usize,
    seeds: &[&[u8]],
) -> ProgramResult {
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(space);

    let metas = [
        AccountMeta { pubkey: payer.key(), is_signer: true, is_writable: true },
        AccountMeta { pubkey: new_account.key(), is_signer: true, is_writable: true },
    ];

    let mut buf = Vec::with_capacity(4 + 8 + 8 + 32);
    buf.extend_from_slice(&0u32.to_le_bytes()); // CreateAccount
    buf.extend_from_slice(&required_lamports.to_le_bytes());
    buf.extend_from_slice(&(space as u64).to_le_bytes());
    buf.extend_from_slice(program_id);

    let ix = Instruction {
        program_id: system_program.key(),
        accounts: &metas,
        data: &buf,
    };
    
    // Use adapter to bridge Pinocchio types to Solana Program types for invocation
    invoke_signed_adapter(
        &ix,
        &[payer, new_account],
        seeds,
    )?;
    
    let mut account_data = new_account.try_borrow_mut_data()?;
    account_data[..init_data.len()].copy_from_slice(init_data);
    
    Ok(())
}

fn invoke_transfer(
    from: &AccountInfo,
    to: &AccountInfo,
    system_program: &AccountInfo,
    lamports: u64,
) -> ProgramResult {
     let metas = [
        AccountMeta { pubkey: from.key(), is_signer: true, is_writable: true },
        AccountMeta { pubkey: to.key(), is_signer: false, is_writable: true },
    ];

    let mut buf = Vec::with_capacity(4 + 8);
    buf.extend_from_slice(&2u32.to_le_bytes()); 
    buf.extend_from_slice(&lamports.to_le_bytes());

     let ix = Instruction {
        program_id: system_program.key(),
        accounts: &metas,
        data: &buf,
    };
    
    pinocchio::program::invoke(
        &ix,
        &[from, to],
    )
}

fn verify_merkle_proof(proof: &Vec<[u8; 32]>, root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut current_hash = leaf;
    for hash in proof {
        let data = if current_hash <= *hash {
            [current_hash, *hash].concat()
        } else {
            [*hash, current_hash].concat()
        };
        current_hash = keccak::hash(&data).0;
    }
    current_hash == root
}

pinocchio::entrypoint!(process_instruction);


#[cfg(not(target_os = "solana"))]
#[no_mangle]
pub unsafe extern "C" fn sol_memset_(s: *mut u8, c: u8, n: usize) {
    std::ptr::write_bytes(s, c, n);
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
pub unsafe extern "C" fn sol_memcpy_(dst: *mut u8, src: *const u8, n: usize) {
    std::ptr::copy_nonoverlapping(src, dst, n);
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
pub unsafe extern "C" fn sol_memmove_(dst: *mut u8, src: *const u8, n: usize) {
    std::ptr::copy(src, dst, n);
}

#[cfg(not(target_os = "solana"))]
#[no_mangle]
pub unsafe extern "C" fn sol_memcmp_(s1: *const u8, s2: *const u8, n: usize, result: *mut i32) {
    let s1 = std::slice::from_raw_parts(s1, n);
    let s2 = std::slice::from_raw_parts(s2, n);
    let cmp = s1.cmp(s2);
    *result = match cmp {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    };
}

fn invoke_signed_adapter(
    ix: &Instruction,
    accounts: &[&AccountInfo],
    seeds: &[&[u8]],
) -> ProgramResult {
    // 1. Convert Instruction
    let sol_program_id = SolPubkey::new_from_array(*ix.program_id);
    let sol_accounts_meta = ix.accounts.iter().map(|meta| {
        let pubkey = SolPubkey::new_from_array(*meta.pubkey);
        if meta.is_writable {
            solana_program::instruction::AccountMeta::new(pubkey, meta.is_signer)
        } else {
            solana_program::instruction::AccountMeta::new_readonly(pubkey, meta.is_signer)
        }
    }).collect::<Vec<_>>();
    
    let sol_ix = solana_program::instruction::Instruction {
        program_id: sol_program_id,
        accounts: sol_accounts_meta,
        data: ix.data.to_vec(),
    };
    
    // 2. Convert AccountInfos
    let mut sol_account_infos = Vec::with_capacity(accounts.len());
    for acc in accounts {
         let key: &SolPubkey = unsafe { std::mem::transmute(acc.key) };
         let owner: &SolPubkey = unsafe { std::mem::transmute(acc.owner) };
         
         let lamports = unsafe { std::mem::transmute(acc.lamports.clone()) };
         let data = unsafe { std::mem::transmute(acc.data.clone()) };
         
         let sol_info = solana_program::account_info::AccountInfo {
             key,
             is_signer: acc.is_signer,
             is_writable: acc.is_writable,
             lamports,
             data,
             owner,
             executable: acc.executable,
             rent_epoch: acc.rent_epoch,
         };
         sol_account_infos.push(sol_info);
    }
    
    // 3. Invoke
    // Note: Pinocchio seeds are &[&[u8]]. Solana expects &[&[&[u8]]].
    // Since we are passing one signer (the PDA), we wrap it.
    let signers_seeds: &[&[&[u8]]] = &[seeds];

    match solana_program::program::invoke_signed(
        &sol_ix,
        &sol_account_infos,
        signers_seeds,
    ) {
        Ok(()) => Ok(()),
        Err(_) => Err(ProgramError::Custom(0)), // Map error generic
    }
}

#[cfg(not(target_os = "solana"))]

pub fn process_instruction_test(
    program_id: &SolPubkey,
    accounts: &[solana_program::account_info::AccountInfo],
    instruction_data: &[u8],
) -> solana_program::entrypoint::ProgramResult {
    // Safety: SolPubkey is repr(transparent) over [u8; 32]
    // AccountInfo layout is compatible between Pinocchio and Solana Program (mostly)
    let program_id_bytes: &[u8; 32] = unsafe { std::mem::transmute(program_id) };
    let accounts_pinocchio: &[AccountInfo] = unsafe { std::mem::transmute(accounts) };
    
    match process_instruction(program_id_bytes, accounts_pinocchio, instruction_data) {
        Ok(()) => Ok(()),
        Err(e) => {
             // Pinocchio ProgramError -> u64. Solana Custom -> u32.
             let code: u64 = e.into();
             Err(solana_program::program_error::ProgramError::Custom(code as u32))
        },
    }
}
