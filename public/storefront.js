const byId = (id) => document.getElementById(id);
const search = byId('search');
const brand = byId('brand');
const family = byId('family');
const priceBand = byId('price-band');
const availability = byId('availability');
const sort = byId('sort');
const status = byId('catalog-status');
const grid = byId('products');
const retry = byId('retry');
const collator = new Intl.Collator('es', { sensitivity: 'base' });

let products = [];
let catalogEntries = [];
let displayedEntries = [];
let whatsapp = '';
let settings = {};
let cart = [];
try {
  const saved = JSON.parse(localStorage.getItem('ba-cart') || '[]');
  if (Array.isArray(saved)) {
    const seen = new Set();
    cart = saved.filter((item) => {
      if (!item || typeof item.productId !== 'string' || seen.has(item.productId) ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999999) return false;
      seen.add(item.productId);
      return true;
    });
  }
} catch {}
let catalogReady = false;
let noticeTimeout;
let lastRequest;
const checkout = byId('checkout');
const orderForm = byId('order-form');
const payment = byId('order-payment');
const checkoutStatus = byId('checkout-status');

function paymentOptions() {
  const options = [
    settings.yappyAlias && ['yappy', 'Yappy'],
    settings.cashOnDelivery && ['cash', 'Efectivo contra entrega'],
    settings.cardOnDelivery && ['card', 'Tarjeta contra entrega (POS)'],
  ].filter(Boolean);
  return options.length ? options : [['coordinate', 'A coordinar por WhatsApp']];
}

function paymentInstructions() {
  const instructions = {
    yappy: 'En Yappy, busca el comercio con el alias ' + settings.yappyAlias + '. Espera la confirmación del total antes de pagar.',
    cash: 'Paga en efectivo al recibir el pedido.',
    card: 'Paga con tarjeta usando el POS del repartidor al recibir el pedido.',
    coordinate: 'Acuerda el método de pago con la tienda al enviar el pedido.',
  };
  byId('order-payment-help').textContent = instructions[payment.value] || '';
}

function cartProduct(id) {
  return products.find((p) => p.id === id);
}

function saveCart() {
  try { localStorage.setItem('ba-cart', JSON.stringify(cart)); } catch {}
  lastRequest = null;
  checkoutStatus.textContent = '';
  renderCart();
}

function notifyCart(message) {
  byId('cart-notice').hidden = false;
  byId('notice-text').textContent = message;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { byId('cart-notice').hidden = true; }, 4000);
}

function addToCart(product) {
  const item = cart.find((entry) => entry.productId === product.id);
  const next = (item?.quantity || 0) + 1;
  if (next > (product.stock ?? 999999)) return notifyCart('Ya agregaste todas las unidades disponibles.');
  if (item) item.quantity = next;
  else cart.push({ productId: product.id, quantity: 1 });
  saveCart();
  notifyCart(product.name + ' se agregó al carrito.');
}

function openCart() {
  byId('cart-notice').hidden = true;
  orderForm.hidden = true;
  renderCart();
  checkout.showModal();
}

function cartRow(item, product) {
  const row = element('div', 'cart-row');
  if (product?.image) {
    const image = element('img', 'cart-photo');
    image.src = product.image;
    image.alt = '';
    row.append(image);
  }
  const info = element('div', 'cart-line');
  const name = product?.name || 'Perfume retirado del catálogo';
  info.append(element('strong', '', name));
  if (product) info.append(element('small', 'muted', [product.size, product.price || 'Precio por confirmar'].filter(Boolean).join(' · ')));
  if (product && (product.available === false || product.stock === 0)) {
    info.append(element('small', 'muted', 'Agotado'));
  } else if (product?.stock != null && item.quantity > product.stock) {
    info.append(element('small', 'muted', 'Unidades disponibles: ' + product.stock));
  }
  const controls = element('div', 'quantity-controls');
  function action(label, description, change) {
    const button = element('button', '', label);
    button.type = 'button';
    button.setAttribute('aria-label', description + ' ' + name);
    button.addEventListener('click', () => {
      change();
      saveCart();
      const replacement = Array.from(byId('cart-items').querySelectorAll('button')).find((b) =>
        !b.disabled && b.getAttribute('aria-label') === button.getAttribute('aria-label'));
      (replacement || byId('continue-shopping')).focus({ preventScroll: true });
    });
    return button;
  }
  const less = action('−', 'Reducir cantidad de', () => { item.quantity--; });
  less.disabled = item.quantity <= 1;
  const more = action('+', 'Aumentar cantidad de', () => { item.quantity++; });
  more.disabled = !product || product.available === false || item.quantity >= (product.stock ?? 999999);
  const remove = action('Quitar', 'Quitar', () => { cart = cart.filter((entry) => entry !== item); });
  controls.append(less, element('span', '', String(item.quantity)), more, remove);
  info.append(controls);
  row.append(info);
  return row;
}

function renderCart() {
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  byId('cart-count').textContent = String(units);
  const basket = cart.map((item) => ({ ...item, product: cartProduct(item.productId) }));
  byId('cart-items').replaceChildren(...(catalogReady ? basket.map((line, i) => cartRow(cart[i], line.product)) : []));
  const allPresent = basket.every(({ product }) => product);
  const valid = catalogReady && units && basket.every(({ product, quantity }) =>
    product && product.available !== false && (product.stock == null || product.stock >= quantity));
  byId('subtotal').textContent = CartPrices.format(allPresent ? CartPrices.total(basket) : null);
  byId('cart-total').hidden = !units || !catalogReady;
  let help = 'El envío y el total final se confirman por WhatsApp.';
  if (!catalogReady) help = 'El catálogo debe estar cargado para revisar tu carrito.';
  else if (!units) help = 'Tu carrito está vacío. Explora los perfumes y agrega tus favoritos.';
  else if (!valid) help = 'Hay artículos con disponibilidad insuficiente. Ajusta sus cantidades o quítalos del carrito.';
  else if (!whatsapp) help = 'La tienda aún no ha habilitado las compras por WhatsApp.';
  byId('cart-help').textContent = help;
  if (!valid) orderForm.hidden = true;
  byId('checkout-next').hidden = !valid || !orderForm.hidden;
  byId('order-submit').disabled = !whatsapp;
}

['open-cart', 'footer-cart', 'notice-open'].forEach((id) => byId(id).addEventListener('click', openCart));
byId('continue-shopping').addEventListener('click', () => {
  checkout.close();
  location.hash = 'catalogo';
});
byId('checkout-next').addEventListener('click', () => {
  orderForm.hidden = false;
  byId('checkout-next').hidden = true;
  payment.focus();
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!whatsapp) return;
  const button = byId('order-submit');
  button.disabled = true;
  checkoutStatus.textContent = 'Preparando pedido…';
  try {
    const fields = Object.fromEntries(new FormData(orderForm));
    const body = JSON.stringify({ ...fields, items: cart, payment: payment.value });
    if (lastRequest?.body !== body) {
      const response = await fetch('/api/orders/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) await loadCatalog();
        throw new Error(result.error);
      }
      if (!checkout.open || body !== JSON.stringify({ ...Object.fromEntries(new FormData(orderForm)), items: cart, payment: payment.value })) {
        throw new Error('El pedido cambió. Revisa el carrito antes de enviarlo.');
      }
      lastRequest = { body, url: result.url };
    }
    checkoutStatus.textContent = 'Envía el mensaje en WhatsApp para que la tienda reciba tu solicitud.';
    location.assign(lastRequest.url);
  } catch (error) {
    checkoutStatus.textContent = error.message || 'No pudimos preparar el pedido. Vuelve a intentarlo.';
  } finally {
    button.disabled = !whatsapp;
  }
});
payment.addEventListener('change', paymentInstructions);
byId('checkout-close').addEventListener('click', () => checkout.close());

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
    .replace(/(\d)\s*(ml|oz)\b/g, '$1$2').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text || '';
  return node;
}

function contactUrl(message) {
  return 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(message);
}

function productCard(product) {
  const card = element('article', 'product');
  const photo = element('div', 'product-photo');
  const placeholder = () => { photo.textContent = 'Foto no disponible'; };
  if (/^(\/(?!\/)|https:\/\/)/.test(product.image || '')) {
    const image = element('img', '');
    image.alt = product.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', placeholder, { once: true });
    image.src = product.image;
    photo.append(image);
  } else {
    placeholder();
  }

  const info = element('div', 'product-info');
  if (product.brand) info.append(element('p', 'brand-name', product.brand));
  info.append(element('h3', '', product.name));
  const details = [product.size, product.family].filter(Boolean).join(' · ');
  if (details) info.append(element('p', 'muted', details));
  if (product.description) info.append(element('p', '', product.description));
  info.append(element('p', 'price', product.price || 'Precio a consultar'));
  const soldOut = product.available === false || product.stock === 0;
  if (soldOut) info.append(element('p', 'muted', 'Agotado'));
  const actions = element('div', 'product-actions');
  if (!soldOut) {
    const button = element('button', 'button primary', 'Agregar al carrito');
    button.type = 'button';
    button.setAttribute('aria-label', 'Agregar ' + product.name + ' al carrito');
    button.addEventListener('click', () => addToCart(product));
    actions.append(button);
  }
  if (whatsapp) {
    const label = soldOut ? 'Consultar reposición' : 'Consultar por WhatsApp';
    const link = element('a', 'product-inquiry', label);
    link.setAttribute('aria-label', label + ' · ' + product.name);
    link.href = contactUrl('Hola, vi ' + [product.name, product.size].filter(Boolean).join(' · ') + ' en Bell Aroma. ' +
      (soldOut ? '¿Cuándo volverá a estar disponible?' : '¿Me dan más información sobre esta fragancia?'));
    link.target = '_blank';
    link.rel = 'noopener';
    actions.append(link);
  }
  info.append(actions);
  card.append(photo, info);
  return card;
}

function catalogEntry(product) {
  const price = CartPrices.cents(product.price);
  let band = 'ask';
  if (price !== null) band = price < 5000 ? 'under50' : price < 10000 ? '50to100' : '100plus';
  const soldOut = product.available === false || product.stock === 0;
  return {
    product, price, band, name: normalize(product.name), brand: normalize(product.brand), family: normalize(product.family),
    availability: soldOut ? 'out' : product.stock == null ? 'ask' : 'stock',
    text: normalize([product.name, product.brand, product.family, product.description, product.size].join(' ')),
  };
}

function populateFacet(select, key) {
  const previous = select.value;
  const labels = new Map();
  for (const entry of catalogEntries) {
    if (entry[key] && !labels.has(entry[key])) labels.set(entry[key], entry.product[key].trim());
  }
  select.options.length = 1;
  const options = Array.from(labels).sort((a, b) => collator.compare(a[1], b[1]));
  options.forEach(([value, label]) => select.add(new Option(label, value)));
  select.value = labels.has(previous) ? previous : '';
  select.parentElement.hidden = !labels.size;
}

function relevance(entry, query) {
  if (entry.name === query) return 0;
  if (entry.name.startsWith(query)) return 1;
  if (entry.name.includes(query) || entry.brand === query) return 2;
  return 3;
}

function render() {
  const query = normalize(search.value);
  const terms = query.split(' ').filter(Boolean);
  const matches = catalogEntries.filter((entry) =>
    (!brand.value || entry.brand === brand.value) &&
    (!family.value || entry.family === family.value) &&
    (!priceBand.value || entry.band === priceBand.value) &&
    (!availability.value || entry.availability === availability.value) &&
    terms.every((term) => entry.text.includes(term))
  );
  if (sort.value === 'name') matches.sort((a, b) => collator.compare(a.product.name, b.product.name));
  else if (sort.value === 'low' || sort.value === 'high') {
    matches.sort((a, b) => {
      if (a.price === null || b.price === null) return Number(a.price === null) - Number(b.price === null);
      return sort.value === 'low' ? a.price - b.price : b.price - a.price;
    });
  } else if (query) matches.sort((a, b) => relevance(a, query) - relevance(b, query));

  if (matches.length !== displayedEntries.length || matches.some((entry, i) => displayedEntries[i] !== entry)) {
    grid.replaceChildren(...matches.map((entry) => entry.card ??= productCard(entry.product)));
    displayedEntries = matches;
  }
  const noun = products.length === 1 ? 'fragancia' : 'fragancias';
  status.textContent = matches.length === products.length ? products.length + ' ' + noun :
    matches.length + ' de ' + products.length + ' ' + noun;
  if (!products.length) status.textContent = 'Pronto encontrarás aquí nuestras fragancias.';
  byId('empty-results').hidden = !products.length || matches.length > 0;
  renderFilterSummary();
}

function renderFilterSummary() {
  const facets = [brand, family, priceBand, availability].filter((control) => control.value);
  const count = byId('filter-count');
  count.textContent = String(facets.length);
  count.hidden = !facets.length;
  byId('clear-search').hidden = !search.value;
  const selected = [...facets];
  if (search.value.trim()) selected.unshift(search);
  if (sort.value !== 'default') selected.push(sort);
  byId('active-filters').hidden = !selected.length;
  byId('filter-chips').replaceChildren(...selected.map((control) => {
    const label = control === search ? '“' + search.value.trim() + '”' : control.selectedOptions[0].text;
    const chip = element('button', 'filter-chip', label);
    chip.type = 'button';
    chip.setAttribute('aria-label', 'Quitar ' + label);
    chip.addEventListener('click', () => {
      control.value = control === sort ? 'default' : '';
      render();
      (control.closest('[hidden]') ? byId('filter-toggle') : control).focus();
    });
    return chip;
  }));
}

async function loadCatalog() {
  retry.hidden = true;
  status.textContent = 'Cargando catálogo…';
  try {
    const response = await fetch('/api/store', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catálogo no disponible');
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error('Catálogo inválido');
    products = data.products;
    catalogReady = true;
    settings = data.settings || {};
    const number = String(settings.whatsapp || '').replace(/\D/g, '');
    whatsapp = /^\d{8,20}$/.test(number) ? number : '';
    document.querySelectorAll('[data-contact]').forEach((link) => {
      link.hidden = !whatsapp;
      if (whatsapp) link.href = contactUrl('Hola, quisiera más información sobre las fragancias de Bell Aroma.');
      else link.removeAttribute('href');
    });
    const options = paymentOptions();
    const previous = payment.value;
    payment.replaceChildren(...options.map(([key, label]) => new Option(label, key)));
    if (options.some(([key]) => key === previous)) payment.value = previous;
    paymentInstructions();
    byId('footer-address').textContent = settings.address || 'Ciudad de Panamá';
    byId('footer-hours').textContent = settings.hours || '';
    byId('footer-hours').hidden = !settings.hours;
    byId('footer-payments').textContent = options.filter(([key]) => key !== 'coordinate').map(([, label]) => label).join(' · ');
    catalogEntries = products.map(catalogEntry);
    populateFacet(brand, 'brand');
    populateFacet(family, 'family');
    const hasPrices = catalogEntries.some((entry) => entry.price !== null);
    byId('price-field').hidden = !hasPrices;
    if (!hasPrices) {
      priceBand.value = '';
      if (sort.value === 'low' || sort.value === 'high') sort.value = 'default';
    }
    for (const option of sort.options) {
      if (option.value === 'low' || option.value === 'high') option.disabled = !hasPrices;
    }
    byId('filters').hidden = !products.length;
    render();
    renderCart();
  } catch {
    status.textContent = 'No pudimos cargar el catálogo. Inténtalo de nuevo.';
    retry.hidden = false;
  }
}

search.addEventListener('input', render);
[brand, family, priceBand, availability, sort].forEach((control) => control.addEventListener('change', render));
byId('filters').addEventListener('submit', (event) => { event.preventDefault(); render(); });
byId('filter-toggle').addEventListener('click', (event) => {
  const panel = byId('filter-panel');
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
});
byId('clear-search').addEventListener('click', () => { search.value = ''; render(); search.focus(); });
function resetFilters() {
  byId('filters').reset();
  render();
  search.focus();
}
byId('reset-filters').addEventListener('click', resetFilters);
byId('show-all').addEventListener('click', resetFilters);
retry.addEventListener('click', loadCatalog);

const theme = byId('theme');
let themePreference;
try { themePreference = localStorage.getItem('ba-theme'); } catch {}

function applyTheme() {
  const dark = themePreference === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.setAttribute('aria-pressed', String(dark));
}

theme.addEventListener('click', () => {
  themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ba-theme', themePreference); } catch {}
  applyTheme();
});
applyTheme();
byId('footer-year').textContent = new Date().getFullYear();
renderCart();
loadCatalog();
