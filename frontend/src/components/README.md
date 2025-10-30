# Frontend Components

This directory contains all the reusable components for the Rock Paper Scissors Bracket game.

## Component Structure

### Core Game Components

- **`GameList.tsx`** - Displays a list of available games with status, players, and prize pool information
- **`BracketDisplay.tsx`** - Tournament bracket visualization showing all rounds and matchups
- **`MatchupTile.tsx`** - Individual matchup component showing player status, moves, and results
- **`MoveSubmissionModal.tsx`** - Modal for submitting and revealing moves during gameplay
- **`ClaimPrizeButton.tsx`** - Button for winners to claim their prize

### Layout & UI

- **`Layout.tsx`** - Main layout wrapper with navigation and theme support
- **`Sidebar.tsx`** - Navigation sidebar
- **`ThemeSelector.tsx`** - Theme switcher for light/dark mode

### Utility

- **`index.ts`** - Barrel export file for clean component imports

## Usage

```tsx
// Import individual components
import { GameList } from './components';

// Or import specific component
import GameList from './components/GameList';
```

## Component Dependencies

All components use:
- `@solana/wallet-adapter-react` for wallet integration
- `@solana/web3.js` for blockchain interactions
- `../services/transactionPacker` for transaction serialization
- `../config/programIds` for program configuration
- `../theme` for consistent styling with t-shirt sizes

## State Management

Components communicate through callback props and local state management. Real-time updates are handled through:
- Manual refresh buttons
- Automatic data fetching on mount
- Event callbacks for user actions
- LocalStorage for move persistence

## Styling

Components use the centralized theme system (`theme.ts`) with:
- T-shirt sizes for spacing, font sizes, and border radius
- CSS variables for theme-aware colors
- Consistent design tokens across all components
- Support for light and dark themes
