const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

// ─── File uploads → disk ──────────────────────────────────────────────────────
// Files live next to the SQLite database so a single persistent volume covers
// both (e.g. /data/harthome.db + /data/uploads). Filenames are unguessable
// random ids; the client sends a data URL and gets back a stable /uploads path.
// This keeps big photo/document blobs OUT of the database.

const uploadsDir = path.join(path.dirname(config.databasePath), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB decoded
const EXT_BY_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'text/plain': 'txt',
};

const router = express.Router(); // mounted behind requireAuth

router.post('/', (req, res) => {
  const { data, name } = req.body || {};
  const m = typeof data === 'string' && data.match(/^data:([\w./+-]+);base64,(.+)$/s);
  if (!m) return res.status(400).json({ error: 'Send a base64 data URL in "data".', code: 'BAD_UPLOAD' });
  const [, mime, b64] = m;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'File is too large (10 MB max).', code: 'TOO_LARGE' });

  const ext = EXT_BY_MIME[mime] || (String(name || '').match(/\.(\w{1,5})$/)?.[1] || 'bin').toLowerCase();
  const dir = path.join(uploadsDir, req.householdId);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  res.status(201).json({ url: `/uploads/${req.householdId}/${file}`, size: buf.length, mime });
});

module.exports = { router, uploadsDir };
