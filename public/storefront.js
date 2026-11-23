const byId = (id) => document.getElementById(id);
const instagram = 'https://www.instagram.com/bell_aroma_oficial';
const search = byId('search');
const family = byId('family');
const sort = byId('sort');
const status = byId('catalog-status');
const grid = byId('products');
const retry = byId('retry');
const collator = new Intl.Collator('es', { sensitivity: 'base' });

let products = [];
let whatsapp = '';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text || '';
  return node;
}

function contactUrl(message) {
  return whatsapp ? 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(message) : instagram;
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
  const soldOut = product.available === false;
  if (soldOut) info.append(element('p', 'muted', 'Agotado'));
  const label = soldOut ? 'Consultar reposición' : 'Consultar fragancia';
  const link = element('a', 'button secondary', label);
  link.setAttribute('aria-label', label + ': ' + product.name + ' por ' + (whatsapp ? 'WhatsApp' : 'Instagram'));
  link.href = contactUrl('Hola, vi ' + product.name + ' en Bell Aroma. ' +
    (soldOut ? '¿Cuándo volverá a estar disponible?' : '¿Me confirman el precio y la disponibilidad?'));
  link.target = '_blank';
  link.rel = 'noopener';
  info.append(link);
  card.append(photo, info);
  return card;
}

function render() {
  const query = normalize(search.value.trim());
  const matches = products.filter((product) =>
    (!family.value || product.family === family.value) &&
    normalize([product.name, product.brand, product.family].join(' ')).includes(query)
  );
  if (sort.value === 'name') matches.sort((a, b) => collator.compare(a.name, b.name));
  grid.replaceChildren(...matches.map(productCard));
  if (!products.length) status.textContent = 'Pronto encontrarás aquí nuestras fragancias.';
  else if (!matches.length) status.textContent = 'No encontramos fragancias. Prueba con otra búsqueda o familia.';
  else status.textContent = matches.length === 1 ? '1 fragancia' : matches.length + ' fragancias';
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
    whatsapp = String(data.settings?.whatsapp || '').replace(/\D/g, '');
    document.querySelectorAll('[data-contact]').forEach((link) => {
      link.href = contactUrl('Hola, quisiera más información sobre las fragancias de Bell Aroma.');
      link.textContent = whatsapp ? 'WhatsApp' : 'Instagram';
    });
    const families = [...new Set(products.map((product) => product.family).filter(Boolean))];
    families.sort(collator.compare);
    family.options.length = 1;
    families.forEach((name) => family.add(new Option(name, name)));
    byId('family-field').hidden = !families.length;
    byId('filters').hidden = !products.length;
    render();
  } catch {
    status.textContent = 'No pudimos cargar el catálogo. Inténtalo de nuevo.';
    retry.hidden = false;
  }
}

search.addEventListener('input', render);
family.addEventListener('change', render);
sort.addEventListener('change', render);
retry.addEventListener('click', loadCatalog);

const theme = byId('theme');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let themePreference;
try { themePreference = localStorage.getItem('ba-theme'); } catch {}

function applyTheme() {
  const dark = themePreference === 'dark' || (!themePreference && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.setAttribute('aria-pressed', String(dark));
}

theme.addEventListener('click', () => {
  themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ba-theme', themePreference); } catch {}
  applyTheme();
});
systemTheme.addEventListener('change', applyTheme);
applyTheme();
loadCatalog();
