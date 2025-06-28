import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Serve favicon if you have one in /public
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

app.get('/wallet', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'DaimaPay server is running.' });
});

// Catch all - 404
app.use((req, res) => {
  res.status(404).send('404 - Not Found');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 DaimaPay server running on http://localhost:${PORT}`);
});
