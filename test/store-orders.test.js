const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const sdk = require('@vercel/blob');
const delivery = require('../public/delivery');

test('inventario concurrente y entregas por WhatsApp', async (t) => {
  process.env.BLOB_STORE_ID = 'store_fixture';
  process.env.BLOB_ACCESS = 'private';
  process.env.ADMIN_PASSWORD = 'fixture';
  process.env.SESSION_SECRET = 'fixture-orders';
  const product = { id: 'one', name: 'Perfume', stock: 5, available: true };
  let saved = {
    settings: { whatsapp: '50760000000', yappyAlias: 'Demo', cashOnDelivery: true, cardOnDelivery: true },
    products: [{ ...product }, { id: 'two', name: 'Otro', stock: 7 }],
  };
  let revision = 1;
  let simulateConcurrentSale = false;
  t.mock.method(sdk, 'head', async () => ({ url: 'https://example.invalid/store.json', etag: String(revision) }));
  t.mock.method(sdk, 'get', async (_, options) => {
    assert.equal(options.useCache, false);
    return { blob: { etag: '"' + revision + '"' }, stream: new Response(JSON.stringify(saved)).body };
  });
  t.mock.method(sdk, 'put', async (_, json, options) => {
    if (simulateConcurrentSale) {
      simulateConcurrentSale = false;
      saved.products[0].stock -= 1;
      revision++;
    }
    if (options.ifMatch !== String(revision)) throw new sdk.BlobPreconditionFailedError();
    saved = JSON.parse(json);
    return { etag: String(++revision) };
  });
  const server = require('../app').listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  let token = '';
  async function send(method, route, body, status = 200) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  token = (await send('POST', '/api/login', { password: 'fixture' })).token;
  const save = (original, draft, status) => send('PUT', '/api/products/one', { original, product: draft }, status);
  const draft = { ...product, description: 'Vainilla' };
  simulateConcurrentSale = true;
  const updated = await save(product, draft);
  assert.equal(updated.products[0].stock, 4);
  assert.equal(updated.products[1].stock, 7);
  assert.equal(updated.products[0].description, 'Vainilla');
  const conflict = await save(product, { ...draft, stock: 2 }, 409);
  assert.deepEqual(conflict.conflicts, ['stock']);
  assert.equal(conflict.currentProduct.stock, 4);
  const revised = await save(conflict.currentProduct, { ...conflict.currentProduct, stock: 2 });
  assert.equal(revised.products[0].stock, 2);
  const repeated = await save(conflict.currentProduct, { ...conflict.currentProduct, stock: 2 });
  assert.equal(repeated.version, revised.version);

  const order = { items: [{ productId: 'one', quantity: 1 }], name: 'Cliente', province: 'Panamá Oeste', area: 'La Chorrera', address: 'Calle 1', payment: 'yappy' };
  for (const payment of ['cash', 'card', 'yappy']) {
    const { url } = await send('POST', '/api/orders/request', { ...order, payment });
    const message = new URL(url).searchParams.get('text');
    assert.ok(!message.includes('Teléfono:'));
    assert.equal(message.includes('comprobante'), payment === 'yappy');
    assert.ok(message.includes(delivery.mapSearch(order.address, order.area, order.province)));
  }
  const placeId = 'ChIJ_fixture-123';
  const selected = await send('POST', '/api/orders/request', { ...order, placeId });
  const message = new URL(selected.url).searchParams.get('text');
  const map = new URL(message.split('\n').find(line => line.startsWith('Google Maps: ')).slice('Google Maps: '.length));
  assert.equal(map.searchParams.get('query_place_id'), placeId);
  assert.ok(message.includes('Distrito: La Chorrera'));
  assert.equal(delivery.provinces.length, 10);
  assert.equal(delivery.provinces.flatMap(delivery.districtsFor).length, 70);
  await send('POST', '/api/orders/request', { ...order, province: 'Centro' }, 400);
  await send('POST', '/api/orders/request', { ...order, province: 'Panamá' }, 400);
  await send('POST', '/api/orders/request', { ...order, area: '' }, 400);
  await send('POST', '/api/orders/request', { ...order, placeId: 'https://example.org/' }, 400);
});
