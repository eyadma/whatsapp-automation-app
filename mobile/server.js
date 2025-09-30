const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist directory not found! Please run "npm run build:web" first.');
  process.exit(1);
}

console.log('🚀 Starting WhatsApp Automation Web Server...');
console.log(`📁 Serving files from: ${distPath}`);
console.log(`🌐 Port: ${PORT}`);

// Serve static files from the dist directory
app.use(express.static(distPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    distExists: fs.existsSync(distPath)
  });
});

// Handle React Router (return the index.html file for any non-API routes)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found. Please run "npm run build:web" first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Web server running on port ${PORT}`);
  console.log(`🌐 App available at: http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});
