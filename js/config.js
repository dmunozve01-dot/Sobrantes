const fs = require('fs');
const path = require('path');

// Leer el archivo .env
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error("❌ Error: No se encontró el archivo .env. Crea uno con tus variables.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = (match[2] || '').trim();
    // Quitar comillas si las tiene
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envVars[key] = value;
  }
});

// Crear el contenido del config.js
const configContent = `const APP_CONFIG = {
  GOOGLE_CLIENT_ID: "${envVars.GOOGLE_CLIENT_ID || ''}",
  DIRECT_API_URL: "${envVars.DIRECT_API_URL || ''}",
  async getApiUrl() {
    if (this.DIRECT_API_URL && this.DIRECT_API_URL.includes("http")) {
      return this.DIRECT_API_URL;
    }
    return null;
  }
};
`;

// Escribir el archivo final en la carpeta js
const outputPath = path.join(__dirname, 'js', 'config.js');
fs.writeFileSync(outputPath, configContent);
console.log('✅ Archivo js/config.js generado correctamente con las variables del .env');