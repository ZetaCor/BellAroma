// Guarda productos e imágenes. En Vercel usa Blob; en local usa archivos.
const fs = require('fs');
const path = require('path');
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA = path.join(__dirname, '..', 'data', 'store.json');
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const empty = () => ({ settings: { whatsapp: '' }, products: [] });

async function load() {
  if (USE_BLOB) {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: 'store.json' });
    const b = blobs.find((x) => x.pathname === 'store.json');
    if (!b) return empty();
    const r = await fetch(b.url + '?t=' + Date.now(), { cache: 'no-store' });
    return r.ok ? r.json() : empty();
  }
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { return empty(); }
}

async function save(data) {
  const json = JSON.stringify(data, null, 2);
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    await put('store.json', json, {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json', cacheControlMaxAge: 60,
    });
    return;
  }
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, json);
}

async function saveImage(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Imagen no válida');
  const buf = Buffer.from(m[2], 'base64');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const r = await put('img/' + name, buf, { access: 'public', addRandomSuffix: false, contentType: 'image/' + m[1] });
    return r.url;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

module.exports = { load, save, saveImage };
