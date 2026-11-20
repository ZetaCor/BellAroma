const crypto = require('crypto');
const express = require('express');
const store = require('./lib/store');

const app = express();
app.use(express.json({ limit: '6mb' }));

const PASS = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.SESSION_SECRET || PASS;
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
  validToken((req.headers.authorization || '').replace('Bearer ', ''))
    ? next() : res.status(401).json({ error: 'Sesión vencida' });

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const cleanStore = (b) => ({
  settings: { whatsapp: txt(b && b.settings && b.settings.whatsapp, 20).replace(/\D/g, '') },
  products: (Array.isArray(b && b.products) ? b.products : []).slice(0, 500).map((p) => ({
    id: txt(p.id, 40) || 'p' + Date.now().toString(36),
    name: txt(p.name, 120),
    brand: txt(p.brand, 80),
    family: txt(p.family, 40),
    size: txt(p.size, 20),
    price: txt(p.price, 20),
    description: txt(p.description, 500),
    image: /^(\/|https:\/\/)/.test(p.image || '') ? txt(p.image, 500) : '',
    available: p.available !== false,
    cutout: p.cutout === true,
  })).filter((p) => p.name),
});

app.get('/api/store', async (req, res) => {
  try { res.set('Cache-Control', 'no-store'); res.json(await store.load()); }
  catch (e) { res.status(500).json({ error: 'No se pudo leer la tienda' }); }
});

app.post('/api/login', (req, res) =>
  same((req.body && req.body.password) || '', PASS)
    ? res.json({ token: makeToken() })
    : res.status(401).json({ error: 'Contraseña incorrecta' }));

app.put('/api/store', auth, async (req, res) => {
  try { const data = cleanStore(req.body); await store.save(data); res.json(data); }
  catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

app.post('/api/upload', auth, async (req, res) => {
  try { res.json({ url: await store.saveImage(req.body && req.body.image) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = app;
