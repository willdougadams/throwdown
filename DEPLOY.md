# Deploying to Vercel

This guide will help you deploy the Throwdown app to Vercel so you can access it from your Solana Saga phone.

## Prerequisites

- A Vercel account (sign up at https://vercel.com)
- Git repository (push your code to GitHub, GitLab, or Bitbucket)
- The Solana program already deployed to devnet (current program ID: `3tPcsGuXqWL6n3dgWMUEqMmRhChghjindpHp9LbGbbU5`)

## Deployment Steps

### Option 1: Deploy via Vercel CLI (Fastest)

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. From the project root directory, run:
   ```bash
   vercel
   ```

3. Follow the prompts:
   - Login to your Vercel account
   - Link to existing project or create new one
   - Accept the default settings (vercel.json is already configured)

4. Deploy to production:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin master
   ```

2. Go to https://vercel.com/new

3. Import your repository

4. Vercel will automatically detect the configuration from `vercel.json`

5. Click "Deploy"

## Configuration

The app is already configured to work with Vercel:

- **Build Command**: `cd frontend && yarn build`
- **Output Directory**: `frontend/dist`
- **Framework**: None (custom Vite setup)
- **Network**: Defaults to devnet when deployed

## Network Configuration

The app automatically detects the network:
- **Localhost** → localnet (local Solana test validator)
- **Deployed** → devnet by default
- Users can switch networks using the Network Selector in the UI

## PWA Support

The app is configured as a Progressive Web App (PWA):
- Users can "Add to Home Screen" on their Solana Saga phone
- Works offline with service worker caching
- Icons are optimized for mobile devices

## After Deployment

1. Visit your deployed URL (e.g., `https://your-app.vercel.app`)

2. On your Solana Saga phone:
   - Open the URL in your browser
   - Make sure you're connected to devnet in the Network Selector
   - Connect your Phantom wallet
   - Tap the menu and select "Add to Home Screen"

3. The app will now work like a native app on your phone!

## Important Notes

- The app uses the **devnet** Solana network by default
- Make sure your Phantom wallet is also set to devnet
- You'll need devnet SOL to play (get it from https://faucet.solana.com/)
- The program ID is automatically loaded from `program-ids.json`

## Updating the Deployment

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push origin master
```

Vercel will automatically redeploy on push if you connected via the dashboard.

Or use the CLI:
```bash
vercel --prod
```

## Troubleshooting

**Build fails**: Check that all dependencies are in `package.json` (not just dev dependencies)

**Wallet won't connect**: Make sure you're on devnet in both the app and your wallet

**Program not found**: Verify the program is deployed to devnet and `program-ids.json` is up to date

**Icons not loading**: Run `node frontend/scripts/generate-icons.js` if you need to regenerate icons
