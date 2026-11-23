const crypto = require('crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const express = require('express');
const store = require('./lib/store');
const prices = require('./public/cart-prices');
const delivery = require('./public/delivery');

const app = express();
app.use(express.json({ limit: '6mb' }));

const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const PASS = process.env.ADMIN_PASSWORD || (production ? '' : 'admin123');
const SECRET = process.env.SESSION_SECRET || (production ? '' : PASS);
const adminReady = Boolean(PASS && SECRET);
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const makeToken = () => { const exp = String(Date.now() + 12 * 3600 * 1000); return exp + '.' + sign(exp); };
const validToken = (t) => {
  const [exp, sig] = String(t || '').split('.');
  return !!exp && !!sig && Number(exp) > Date.now() && same(sig, sign(exp));
};
const auth = (req, res, next) =>
  adminReady && validToken((req.headers.authorization || '').replace('Bearer ', ''))
    ? next() : res.status(401).json({ error: 'Sesión vencida' });

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const count = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 999999;
const cleanSettings = (settings) => ({
  whatsapp: txt(settings?.whatsapp, 20).replace(/\D/g, ''),
  yappyAlias: txt(settings?.yappyAlias, 60),
  cashOnDelivery: settings?.cashOnDelivery === true,
  cardOnDelivery: settings?.cardOnDelivery === true,
  address: txt(settings?.address, 160),
  hours: txt(settings?.hours, 120),
  mapPin: delivery.mapPin(txt(settings?.mapPin, 2048)),
});
const cleanProduct = (p) => ({
    id: txt(p.id, 40) || crypto.randomUUID(),
    name: txt(p.name, 120),
    brand: txt(p.brand, 80),
    family: txt(p.family, 40),
    size: txt(p.size, 20),
    price: txt(p.price, 20),
    description: txt(p.description, 500),
    image: /^(\/|https:\/\/)/.test(p.image || '') ? txt(p.image, 500) : '',
    available: p.available !== false,
    stock: count(p.stock) ? p.stock : null,
    cutout: p.cutout === true,
});
const cleanStore = (b) => ({
  settings: cleanSettings(b?.settings),
  products: (Array.isArray(b?.products) ? b.products : []).slice(0, 500).map(cleanProduct).filter((p) => p.name),
});

const publicStore = ({ data, version }) => ({ settings: data.settings, products: data.products, version });
function fail(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  // Keep credentials, request bodies and customer details out of diagnostic logs.
  console.error(fallback, error.constructor.name, error.code || '');
  const { BlobAccessError, BlobStoreNotFoundError, BlobStoreSuspendedError, BlobError } = require('@vercel/blob');
  let message = fallback;
  if (error instanceof BlobAccessError || error instanceof BlobStoreNotFoundError) {
    message = 'Vercel Blob denegó el acceso al almacén. Revisa la conexión del proyecto y su entorno de despliegue.';
  } else if (error instanceof BlobStoreSuspendedError) {
    message = 'El almacén de Vercel Blob está suspendido. Revisa su estado en Vercel.';
  } else if (error instanceof BlobError) {
    message = 'Vercel Blob no pudo completar la operación. Revisa la conexión, los permisos y el estado del almacén.';
  } else if (['EROFS', 'EACCES', 'EPERM', 'ENOSPC'].includes(error.code)) {
    message = 'El servidor no pudo escribir los datos. Revisa los permisos y el espacio disponible del almacenamiento.';
  }
  return res.status(message === fallback ? 500 : 503).json({ error: message });
}
const reject = (message, status = 400) => Object.assign(new Error(message), { status });

app.get('/api/store', async (req, res) => {
  try { res.set('Cache-Control', 'no-store'); res.json(publicStore(await store.read())); }
  catch (e) { fail(res, e, 'No se pudo leer la tienda'); }
});

app.post('/api/login', (req, res) => {
  if (!adminReady) return res.status(503).json({ error: 'Falta configurar el acceso al panel.' });
  return same((req.body && req.body.password) || '', PASS)
    ? res.json({ token: makeToken() })
    : res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.put('/api/store', auth, async (req, res) => {
  try {
    const current = await store.read();
    if (req.body?.version !== current.version) throw store.conflict();
    const data = { ...current.data, ...cleanStore(req.body) };
    const version = await store.save(data, current.version);
    res.json(publicStore({ data, version }));
  } catch (error) { fail(res, error, 'No se pudo guardar'); }
});

app.put('/api/store/settings', auth, async (req, res) => {
  try {
    const { settings, version } = req.body || {};
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw reject('Revisa la configuración.');
    if (settings.mapPin && (settings.mapPin.length > 2048 || !delivery.mapPin(settings.mapPin))) throw reject('Revisa el enlace de Google Maps de la tienda.');
    const current = await store.read();
    if (version !== current.version) throw store.conflict();
    const data = { ...current.data, settings: cleanSettings({ ...current.data.settings, ...settings }) };
    const savedVersion = await store.save(data, current.version);
    res.json(publicStore({ data, version: savedVersion }));
  } catch (error) { fail(res, error, 'No se pudo guardar la configuración'); }
});

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const { original, product } = req.body || {};
    const id = req.params.id;
    if (!product || product.id !== id || id.length > 40 || (original !== null && original?.id !== id)) {
      throw reject('Revisa el producto que quieres guardar.');
    }
    const draft = cleanProduct(product);
    if (!draft.name || (product.stock != null && !count(product.stock))) throw reject('Revisa el nombre y el inventario.');
    const base = original && cleanProduct(original);
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await store.read();
      const list = current.data.products;
      const index = list.findIndex((item) => item.id === id);
      if (base && index === -1) throw reject('El producto fue eliminado. Tu edición sigue abierta.', 409);
      if (index === -1 && list.length >= 500) throw reject('El catálogo admite hasta 500 perfumes.');
      if (index === -1) list.unshift(draft);
      else {
        const latest = cleanProduct(list[index]);
        const changes = Object.keys(draft).filter((key) => !base || draft[key] !== base[key]);
        const pending = changes.filter((key) => draft[key] !== latest[key]);
        if (!pending.length) return res.json(publicStore(current));
        const conflicts = pending.filter((key) => !base || base[key] !== latest[key]);
        if (conflicts.length) {
          return res.status(409).json({ error: 'Otra edición modificó este perfume.', currentProduct: latest, conflicts });
        }
        for (const key of pending) list[index][key] = draft[key];
      }
      try {
        const version = await store.save(current.data, current.version);
        return res.json(publicStore({ data: current.data, version }));
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
      }
    }
  } catch (error) { fail(res, error, 'No se pudo guardar el producto'); }
});

const paymentOptions = (settings) => ({
  yappy: settings.yappyAlias ? 'Yappy' : '',
  cash: settings.cashOnDelivery ? 'Efectivo contra entrega' : '',
  card: settings.cardOnDelivery ? 'Tarjeta contra entrega (POS)' : '',
});

function orderLines(data, order, completing = false) {
  // Codes from the original storefront contained one product at the top level.
  const items = order.items === undefined ? [order] : order.items;
  if (!Array.isArray(items) || !items.length || items.length > 500) throw reject('Revisa los artículos de tu carrito.');
  const seen = new Set();
  return items.map((item) => {
    if (!item || !count(item.quantity) || item.quantity < 1 || seen.has(item.productId)) {
      throw reject('Revisa las cantidades y productos del carrito.');
    }
    seen.add(item.productId);
    const product = data.products.find((p) => p.id === item.productId);
    if (!product) throw reject('Un perfume del carrito ya no está en el catálogo.', 409);
    if (completing && product.stock == null) throw reject('Registra las existencias de ' + product.name + ' antes de finalizar.', 409);
    if ((product.stock != null && product.stock < item.quantity) || (!completing && product.available === false)) {
      throw reject('Ya no hay suficientes unidades de ' + product.name + '.', 409);
    }
    return { product, quantity: item.quantity };
  });
}

function decodeOrder(value) {
  const token = String(value || '').trim();
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined || !same(signature, sign('order:' + payload))) {
    throw reject('El código del pedido no es válido.');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

app.post('/api/orders/request', async (req, res) => {
  try {
    if (!adminReady) throw reject('Los pedidos aún no están habilitados.', 503);
    const { data } = await store.read();
    const settings = data.settings || {};
    const body = req.body || {};
    const options = paymentOptions(settings);
    if (!Object.values(options).some(Boolean)) options.coordinate = 'A coordinar por WhatsApp';
    const payment = options[txt(body.payment, 10)];
    const name = txt(body.name, 100);
    const province = txt(body.province, 40);
    const area = txt(body.area, 100);
    const address = txt(body.address, 240);
    const reference = txt(body.reference, 160);
    const pin = String(body.mapPin || '').trim();
    if (pin && (pin.length > 2048 || !delivery.mapPin(pin))) throw reject('Revisa el enlace compartido de Google Maps.');
    if (!/^\d{8,20}$/.test(settings.whatsapp || '') || typeof payment !== 'string' || !payment) {
      throw reject('Este método de pedido no está disponible.');
    }
    if (!name || !delivery.provinces.includes(province) || !area || !address) {
      throw reject('Completa el nombre, la provincia, la localidad y la dirección de entrega.');
    }
    const basket = orderLines(data, body);
    const order = { id: crypto.randomUUID(), items: basket.map(({ product, quantity }) => ({ productId: product.id, quantity })) };
    const payload = Buffer.from(JSON.stringify(order)).toString('base64url');
    const code = payload + '.' + sign('order:' + payload);
    const lines = [
      'Hola, quiero hacer esta compra en Bell Aroma.',
      ...basket.map(({ product, quantity }) => `${quantity} × ${[product.name, product.size].filter(Boolean).join(' · ')} — ${product.price || 'Precio por confirmar'} c/u`),
      'Subtotal de productos: ' + prices.format(prices.total(basket)),
      'Envío a confirmar por la tienda.',
      `Pago: ${payment}`,
      body.payment === 'yappy' && 'Enviaré el comprobante de Yappy en este chat después de confirmar el total.',
      `Nombre: ${name}`,
      `Provincia: ${province}`,
      `Localidad: ${area}`,
      `Dirección: ${address}`,
      'Google Maps: ' + (delivery.mapPin(pin) || delivery.mapSearch(address, area, province)),
      reference && `Referencia: ${reference}`,
      `Código del pedido: ${code}`,
    ];
    res.set('Cache-Control', 'no-store').json({
      url: 'https://wa.me/' + settings.whatsapp + '?text=' + encodeURIComponent(lines.filter(Boolean).join('\n')),
    });
  } catch (error) { fail(res, error, 'No se pudo preparar el pedido'); }
});

app.post('/api/orders/complete', auth, async (req, res) => {
  try {
    const order = decodeOrder(req.body?.code);
    const current = await store.read();
    const { data } = current;
    const completed = data.completedOrders || [];
    if (completed.includes(order.id)) {
      return res.json({ ...publicStore(current), alreadyCompleted: true });
    }
    const basket = orderLines(data, order, true);
    const items = basket.map(({ product, quantity }) => ({ name: product.name, quantity, stock: product.stock }));
    if (req.body?.confirm !== true) {
      return res.json({ items });
    }
    for (const { product, quantity } of basket) product.stock -= quantity;
    data.completedOrders = completed.concat(order.id);
    const version = await store.save(data, current.version);
    res.json(publicStore({ data, version }));
  } catch (error) { fail(res, error, 'No se pudo finalizar el pedido'); }
});

app.post('/api/upload', auth, async (req, res) => {
  try { res.json({ url: await store.saveImage(req.body && req.body.image) }); }
  catch (e) { fail(res, e, 'No se pudo guardar la imagen'); }
});

app.get('/api/product-images/:name', async (req, res) => {
  try {
    const image = await store.readProductImage(req.params.name);
    if (!image) return res.sendStatus(404);
    res.type(image.blob.contentType).set('Cache-Control', 'public, max-age=31536000, immutable');
    await pipeline(Readable.fromWeb(image.stream), res);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) fail(res, error, 'No se pudo cargar la imagen');
  }
});

module.exports = app;
