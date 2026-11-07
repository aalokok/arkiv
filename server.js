// Local development only. In production, Vercel serves api/markers.js directly.
// Run `npm start` here and `npm start` in client/ (CRA proxies /api to this port).
require('dotenv').config();
const express = require('express');
const markersHandler = require('./api/markers');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.all('/api/markers', markersHandler);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
