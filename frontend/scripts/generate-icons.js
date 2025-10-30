// Simple script to generate PWA icons from SVG
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Read the SVG file
const svgPath = path.join(__dirname, '../public/icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

console.log('SVG icon found. To generate PNG icons, you can:');
console.log('1. Use an online tool like https://realfavicongenerator.net/');
console.log('2. Install sharp: npm install sharp --save-dev');
console.log('3. Or use this command with imagemagick:');
console.log('   convert -background none icon.svg -resize 192x192 icon-192.png');
console.log('   convert -background none icon.svg -resize 512x512 icon-512.png');
console.log('');
console.log('For now, creating placeholder PNG files...');

// Try to use sharp if available
try {
  const sharp = require('sharp');

  const svgBuffer = Buffer.from(svgContent);

  Promise.all([
    sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(__dirname, '../public/icon-192.png')),
    sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(__dirname, '../public/icon-512.png'))
  ]).then(() => {
    console.log('✓ Generated icon-192.png and icon-512.png');
  }).catch(err => {
    console.error('Error generating icons:', err);
  });
} catch (err) {
  console.log('Sharp not installed. Install it with: cd frontend && yarn add -D sharp');
  console.log('Then run: node scripts/generate-icons.js');
}
