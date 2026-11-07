// Local development only. In production, Vercel serves api/markers.js directly.
// Run `npm start` here and `npm start` in client/ (CRA proxies /api to this port).
require('dotenv').config();

// On this machine Node's resolver points at 127.0.0.1, which refuses the SRV lookups
// that mongodb+srv:// URIs need. Fall back to public DNS for local dev.
const dns = require('dns');
if (dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')) {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
}

const express = require('express');
const markersHandler = require('./api/markers');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.all('/api/markers', markersHandler);
app.get('/', (req, res) =>
    res.type('text').send('This is the local API only. Open the site at http://localhost:3000 (run `npm start` in client/).')
);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
