// Guarda productos e imágenes. En Vercel usa Blob; en local usa archivos.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const ON_VERCEL = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const ACCESS = process.env.BLOB_ACCESS || 'public';
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
    const { head, get, BlobNotFoundError } = require('@vercel/blob');
    let metadata;
    try {
      metadata = await head('store.json');
    } catch (error) {
      if (error instanceof BlobNotFoundError) return { data: initialStore(), version: null };
      throw error;
    }
    if (!metadata.etag) throw new Error('No se pudo verificar la versión del catálogo');
    // head and put use the storage API's ETag. The download's HTTP ETag can be quoted.
    const url = new URL(metadata.url);
    if (ACCESS === 'public') url.searchParams.set('v', metadata.etag);
    const result = await get(url.href, { access: ACCESS, useCache: ACCESS !== 'private' });
    if (!result) throw conflict();
    return { data: await new Response(result.stream).json(), version: metadata.etag };
  }
  if (ON_VERCEL) return { data: initialStore(), version: null };
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

function requireWritableStorage() {
  if (ON_VERCEL && !USE_BLOB) {
    throw Object.assign(new Error('En Vercel, conecta el almacén Blob al proyecto para Production y vuelve a desplegar. Falta la conexión para guardar los cambios.'), { status: 503 });
  }
}

async function save(data, version) {
  requireWritableStorage();
  const json = JSON.stringify(data, null, 2);
  if (USE_BLOB) {
    const { put, BlobPreconditionFailedError } = require('@vercel/blob');
    try {
      const result = await put('store.json', json, {
        access: ACCESS, addRandomSuffix: false, allowOverwrite: version !== null,
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
  requireWritableStorage();
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Imagen no válida'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const r = await put('img/' + name, buf, { access: ACCESS, addRandomSuffix: false, contentType: 'image/' + m[1] });
    return ACCESS === 'private' ? '/api/product-images/' + name : r.url;
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

async function readProductImage(name) {
  if (!USE_BLOB || !/^p-\d+-[a-z0-9]{1,5}\.(jpg|png|webp)$/.test(name)) return null;
  const { get } = require('@vercel/blob');
  return get('img/' + name, { access: ACCESS });
}

module.exports = { read, save, saveImage, readProductImage, conflict };
