#!/usr/bin/env node

/**
 * Icon Generation Script for FlashAppAI Browser
 * 
 * This script generates all required icon formats from the SVG source.
 * 
 * Requirements:
 * - sharp: npm install sharp
 * - png-to-ico: npm install png-to-ico (for Windows .ico)
 * 
 * For macOS .icns, use iconutil (built-in on macOS)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('📦 Installing sharp for image conversion...');
  require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// Required sizes for different platforms
const SIZES = {
  // macOS iconset sizes
  macos: [16, 32, 64, 128, 256, 512, 1024],
  // Windows ico sizes
  windows: [16, 24, 32, 48, 64, 128, 256],
  // General PNG sizes
  general: [16, 32, 48, 64, 128, 256, 512, 1024]
};

async function generatePNGs() {
  console.log('🎨 Generating PNG icons...');
  
  const svgBuffer = fs.readFileSync(SVG_PATH);
  
  // Generate all sizes
  for (const size of SIZES.general) {
    const outputPath = path.join(ICONS_DIR, `icon_${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  ✅ Generated ${size}x${size} PNG`);
  }
  
  // Also generate main icon.png at 512px
  const mainIconPath = path.join(ICONS_DIR, 'icon.png');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(mainIconPath);
  console.log('  ✅ Generated main icon.png (512x512)');
}

async function generateICO() {
  console.log('🪟 Generating Windows ICO...');
  
  try {
    const pngToIco = require('png-to-ico');
    
    const pngFiles = SIZES.windows.map(size => 
      path.join(ICONS_DIR, `icon_${size}x${size}.png`)
    ).filter(f => fs.existsSync(f));
    
    if (pngFiles.length === 0) {
      console.log('  ⚠️ No PNG files found. Generate PNGs first.');
      return;
    }
    
    const icoBuffer = await pngToIco(pngFiles);
    const icoPath = path.join(ICONS_DIR, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('  ✅ Generated icon.ico');
  } catch (e) {
    console.log('  ⚠️ ICO generation failed:', e.message);
    console.log('  💡 You can use an online converter or ImageMagick to create icon.ico');
  }
}

async function generateICNS() {
  console.log('🍎 Generating macOS ICNS...');
  
  if (process.platform !== 'darwin') {
    console.log('  ⚠️ ICNS generation requires macOS. Skipping...');
    console.log('  💡 On macOS, run: iconutil -c icns icon.iconset');
    return;
  }
  
  const iconsetDir = path.join(ICONS_DIR, 'icon.iconset');
  
  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }
  
  const svgBuffer = fs.readFileSync(SVG_PATH);
  
  // macOS iconset naming convention
  const iconsetSizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];
  
  for (const { name, size } of iconsetSizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, name));
  }
  
  console.log('  ✅ Generated iconset folder');
  
  // Use iconutil to create ICNS
  try {
    const { execSync } = require('child_process');
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(ICONS_DIR, 'icon.icns')}"`, {
      stdio: 'inherit'
    });
    console.log('  ✅ Generated icon.icns');
    
    // Clean up iconset folder
    fs.rmSync(iconsetDir, { recursive: true });
  } catch (e) {
    console.log('  ⚠️ iconutil failed. The iconset folder is ready for manual conversion.');
    console.log(`  💡 Run: iconutil -c icns "${iconsetDir}"`);
  }
}

async function main() {
  console.log('');
  console.log('⚡ FlashAppAI Browser Icon Generator');
  console.log('====================================');
  console.log('');
  
  if (!fs.existsSync(SVG_PATH)) {
    console.error('❌ SVG source not found at:', SVG_PATH);
    process.exit(1);
  }
  
  try {
    await generatePNGs();
    await generateICO();
    await generateICNS();
    
    console.log('');
    console.log('✅ Icon generation complete!');
    console.log('');
    console.log('Generated files:');
    console.log('  - icon.png (main icon)');
    console.log('  - icon.ico (Windows)');
    console.log('  - icon.icns (macOS)');
    console.log('  - icon_NxN.png (various sizes)');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

