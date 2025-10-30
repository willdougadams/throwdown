# PWA Setup Guide for RPS Battleground

## Current Status
✅ PWA manifest configured
✅ Service worker configured with Vite PWA plugin
✅ Placeholder SVG icon created
⚠️  PNG icons need to be generated

## Icon Requirements

### For Local Testing & Development
The current placeholder `icon.svg` works for local testing.

### For Solana dApp Store Submission
You'll need these specific assets:

1. **App Icons (required for manifest):**
   - `icon-192.png` (192x192px) - for mobile home screen
   - `icon-512.png` (512x512px) - for splash screen and dApp store

2. **dApp Store Submission Assets:**
   - Icon: 512x512px PNG
   - Banner: 1200x600px PNG

### Generating Icons

You can generate PNG icons from the SVG using one of these methods:

#### Option 1: Online Tool
1. Go to https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
2. Upload your custom icon design
3. Generate 192x192 and 512x512 PNG files
4. Place them in `frontend/public/`

#### Option 2: Using ImageMagick (if installed)
```bash
cd frontend/public
convert icon.svg -resize 192x192 icon-192.png
convert icon.svg -resize 512x512 icon-512.png
```

#### Option 3: Using Figma/Photoshop/GIMP
Design your icon and export as:
- 192x192px PNG (save as `icon-192.png`)
- 512x512px PNG (save as `icon-512.png`)
- 1200x600px banner (save as `banner.png`)

## Testing the PWA

### Test on Desktop
1. Start dev server: `npm run dev`
2. Open Chrome DevTools → Application → Service Workers
3. Check "Update on reload" to see changes
4. Verify manifest in Application → Manifest

### Test on Android Device (Before dApp Store Submission)

**Option A: Direct PWA Testing (No APK needed)**
1. Deploy your frontend to a public URL (Vercel, Netlify, etc.)
2. Open the URL in Chrome on your Solana Mobile device
3. Chrome will show "Add to Home Screen" prompt
4. Test the PWA experience

**Option B: Local Network Testing**
1. Start dev server: `npm run dev -- --host`
2. Find your local IP: `ip addr show` or `ifconfig`
3. On your phone, connect to same WiFi
4. Visit `http://YOUR_IP:5173` in Chrome
5. Add to home screen and test

**Option C: Build APK with Bubblewrap (Closest to Production)**
Once you have a deployed URL:
```bash
# Install Bubblewrap
npm i -g @bubblewrap/cli

# Initialize (requires deployed URL)
bubblewrap init --manifest https://your-domain.com/manifest.json

# Build APK
bubblewrap build

# Install on device via ADB
adb install ./app-release-signed.apk
```

## Next Steps for Solana dApp Store

1. **Create proper icons** (see above)
2. **Deploy to production** (Vercel/Netlify/etc.)
3. **Test PWA** on actual device
4. **Package as TWA** using Bubblewrap
5. **Submit to dApp Store**:
   ```bash
   npm install -g @solana-mobile/dapp-store-cli
   solana-dapp-store init
   solana-dapp-store publish
   ```

## Service Worker Features

The current setup includes:
- ✅ Auto-update on new versions
- ✅ Offline support for static assets
- ✅ Network-first caching for Solana RPC calls
- ✅ Dev mode enabled for testing

## Mobile Wallet Integration Notes

When testing on mobile:
- Phantom Wallet works via their mobile app's dApp browser
- For standalone PWA/APK, you may need to add:
  - WalletConnect support
  - Solana Mobile Wallet Adapter (for React Native/native apps)

The current Phantom adapter should work in mobile Chrome/dApp browsers.

## Troubleshooting

**Service worker not updating?**
- Check "Update on reload" in DevTools
- Clear application cache
- Hard refresh (Ctrl+Shift+R)

**Icons not showing?**
- Ensure PNG files are in `/frontend/public/`
- Check browser console for 404 errors
- Verify manifest.json paths

**PWA not installable?**
- Must be served over HTTPS (or localhost)
- Manifest must be valid JSON
- Icons must be accessible
- Service worker must be registered
