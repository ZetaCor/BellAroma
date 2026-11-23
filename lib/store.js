// Guarda productos e imágenes. En Vercel usa Blob; en local usa archivos.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA = path.join(__dirname, '..', 'data', 'store.json');
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const initialCatalog = require('../public/products/catalog.json');
const initialStore = () => ({
  settings: { whatsapp: '' },
  products: initialCatalog.map((product) => ({
    family: '', size: '', price: '', description: '', available: true, cutout: false, ...product,
  })),
});

async function read() {
  if (USE_BLOB) {
    const { get } = require('@vercel/blob');
    const result = await get('store.json', { access: 'public' });
    if (!result) return { data: initialStore(), version: null };
    if (!result.blob.etag) throw new Error('No se pudo verificar la versión del catálogo');
    return { data: await new Response(result.stream).json(), version: result.blob.etag };
  }
  try {
    const json = fs.readFileSync(DATA, 'utf8');
    return { data: JSON.parse(json), version: checksum(json) };
  } catch (error) {
    if (error.code === 'ENOENT') return { data: initialStore(), version: null };
    throw error;
  }
}

function checksum(json) {
  return crypto.createHash('sha256').update(json).digest('hex');
}

function conflict() {
  return Object.assign(new Error('La tienda cambió. Actualiza el panel e inténtalo nuevamente.'), { status: 409 });
}

async function save(data, version) {
  const json = JSON.stringify(data, null, 2);
  if (USE_BLOB) {
    const { put, BlobPreconditionFailedError } = require('@vercel/blob');
    try {
      const result = await put('store.json', json, {
        access: 'public', addRandomSuffix: false, allowOverwrite: version !== null,
        ifMatch: version ?? undefined, contentType: 'application/json', cacheControlMaxAge: 60,
      });
      return result.etag;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError ||
          (version === null && /already exists/i.test(error.message))) throw conflict();
      throw error;
    }
  }
  let currentVersion = null;
  try {
    currentVersion = checksum(fs.readFileSync(DATA, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (currentVersion !== version) throw conflict();
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const temp = DATA + '.tmp';
  fs.writeFileSync(temp, json);
  fs.renameSync(temp, DATA);
  return checksum(json);
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

module.exports = { read, save, saveImage, conflict };
