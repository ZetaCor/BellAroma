const Delivery = (() => {
  const provinces = ['Bocas del Toro', 'Coclé', 'Colón', 'Chiriquí', 'Darién', 'Herrera', 'Los Santos', 'Panamá', 'Panamá Oeste', 'Veraguas'];
  function mapSearch(...parts) {
    const url = new URL('https://www.google.com/maps/search/');
    url.searchParams.set('api', '1');
    url.searchParams.set('query', [...parts.filter(Boolean), 'República de Panamá'].join(', '));
    return url.href;
  }
  function mapPin(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
      if (url.hostname === 'maps.app.goo.gl' && /^\/[\w-]+\/?$/.test(url.pathname)) return url.href;
      if (url.hostname === 'goo.gl' && /^\/maps\/[\w-]+\/?$/.test(url.pathname)) return url.href;
      if (['google.com', 'www.google.com', 'google.com.pa', 'www.google.com.pa'].includes(url.hostname)
        && /^\/maps(?:\/|$)/.test(url.pathname)) return url.href;
      if (url.hostname === 'maps.google.com' && url.pathname === '/' && url.searchParams.has('q')) return url.href;
    } catch {}
    return '';
  }
  return { provinces, mapSearch, mapPin };
})();

if (typeof module !== 'undefined') module.exports = Delivery;
