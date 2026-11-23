const Delivery = (() => {
  const districts = {
    'Bocas del Toro': ['Almirante', 'Bocas del Toro', 'Changuinola', 'Chiriquí Grande'],
    'Coclé': ['Aguadulce', 'Antón', 'La Pintada', 'Natá', 'Olá', 'Penonomé'],
    'Colón': ['Chagres', 'Colón', 'Donoso', 'Omar Torrijos Herrera', 'Portobelo', 'Santa Isabel'],
    'Chiriquí': ['Alanje', 'Barú', 'Boquerón', 'Boquete', 'Bugaba', 'David', 'Dolega', 'Gualaca', 'Remedios', 'Renacimiento', 'San Félix', 'San Lorenzo', 'Tierras Altas', 'Tolé'],
    'Darién': ['Chepigana', 'Pinogana', 'Santa Fe'],
    'Herrera': ['Chitré', 'Las Minas', 'Los Pozos', 'Ocú', 'Parita', 'Pesé', 'Santa María'],
    'Los Santos': ['Guararé', 'Las Tablas', 'Los Santos', 'Macaracas', 'Pedasí', 'Pocrí', 'Tonosí'],
    'Panamá': ['Balboa', 'Chepo', 'Chimán', 'Panamá', 'San Miguelito', 'Taboga'],
    'Panamá Oeste': ['Arraiján', 'Capira', 'Chame', 'La Chorrera', 'San Carlos'],
    'Veraguas': ['Atalaya', 'Calobre', 'Cañazas', 'La Mesa', 'Las Palmas', 'Mariato', 'Montijo', 'Río de Jesús', 'San Francisco', 'Santa Fe', 'Santiago', 'Soná'],
  };
  const provinces = Object.keys(districts);
  const districtsFor = (province) => Object.hasOwn(districts, province) ? districts[province] : [];
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
  function deliveryMap(address, district, province, placeId) {
    const url = new URL(mapSearch(address, district, province));
    if (placeId) url.searchParams.set('query_place_id', placeId);
    return url.href;
  }
  return { provinces, districtsFor, mapSearch, mapPin, deliveryMap };
})();

if (typeof module !== 'undefined') module.exports = Delivery;
