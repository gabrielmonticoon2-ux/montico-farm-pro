/**
 * Script pós-build: copia fontes para caminhos curtos em dist/fonts/
 * Evita problemas com caminhos longos no GitHub Pages.
 */
const fs = require('fs');
const path = require('path');

const FONTS_SRC = path.join(__dirname, '..', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');
const FONTS_DEST = path.join(__dirname, '..', 'dist', 'fonts');

if (!fs.existsSync(FONTS_DEST)) fs.mkdirSync(FONTS_DEST, { recursive: true });

// Copia apenas o Ionicons (único usado no app)
const files = fs.readdirSync(FONTS_SRC).filter(f => f.startsWith('Ionicons'));
for (const file of files) {
  fs.copyFileSync(path.join(FONTS_SRC, file), path.join(FONTS_DEST, 'Ionicons.ttf'));
  console.log(`✓ Copiado: ${file} → dist/fonts/Ionicons.ttf`);
}
