use solana_program::pubkey::Pubkey;
use std::str::FromStr;

use std::fs;
fn main() {
    let program_ids_json = fs::read_to_string("../../../scripts/program-ids.json").unwrap();

    // Parse devnet banyan id manually to avoid serde_json dependency
    let devnet_idx = program_ids_json.find("\"devnet\": {").expect("Could not find devnet section");
    let devnet_section = &program_ids_json[devnet_idx..];
    
    let banyan_idx = devnet_section.find("\"banyan\": \"").expect("Could not find banyan key");
    let banyan_start = banyan_idx + "\"banyan\": \"".len();
    let banyan_id = devnet_section[banyan_start..].split('"').next().unwrap();

    let program_id = Pubkey::from_str(banyan_id).unwrap();
    let (pda, _bump) = Pubkey::find_program_address(&[b"manager_v3"], &program_id);
    println!("PDA String: {}", pda.to_string());
    println!("PDA Bytes: {:?}", pda.to_bytes());
}
