When working on this project, testing will require running a localnet solana network and deploying the progam to it, as well as running the frontend (yarn dev) so please run these in the background if we're doing any testing.

solana-test-validator --reset
./setup-test-wallets.sh localnet 16
./deploy.sh localnet
cd frontend
yarn dev

Please do not build or deploy manually, use the deploy script so that program-ids.json stays up to date and the frontend will always use the right program address.

To seed test games with various states:
cd frontend
npx tsx scripts/seed-games.ts localnet