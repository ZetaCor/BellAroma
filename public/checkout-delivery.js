function setupCheckoutDelivery(form) {
  const fallback = form.querySelector('#order-address');
  const label = form.querySelector('#address-label');
  const help = form.querySelector('#address-help');
  let widget;
  let loading;
  let selection;
  const mapsHint = 'Elige una sugerencia de Google Maps o escribe tu dirección completa.';

  function regionPicker(buttonId, fieldName, onChange) {
    const button = form.querySelector('#' + buttonId);
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    function expand(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
    button.addEventListener('click', () => {
      expand(panel.hidden);
      if (!panel.hidden) (panel.querySelector(':checked') || panel.querySelector('input'))?.focus();
    });
    const field = button.parentElement;
    field.addEventListener('focusout', (event) => {
      if (!field.contains(event.relatedTarget)) expand(false);
    });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        event.preventDefault();
        event.stopPropagation();
        expand(false);
        button.focus();
      }
      if (event.key === 'Enter' && event.target.matches('input')) {
        event.preventDefault();
        event.target.click();
      }
    });
    panel.addEventListener('change', (event) => {
      button.textContent = event.target.value;
      onChange(event.target.value);
    });
    panel.addEventListener('click', (event) => {
      if (event.target.matches('input')) {
        // Native radio groups also fire click when the arrow keys move the selection.
        if (arrowNavigation) return;
        expand(false);
        button.focus();
      }
    });
    let arrowNavigation = false;
    panel.addEventListener('keydown', (event) => { arrowNavigation = event.key.startsWith('Arrow'); });
    panel.addEventListener('keyup', () => { arrowNavigation = false; });
    panel.addEventListener('pointerdown', () => { arrowNavigation = false; });
    panel.addEventListener('invalid', () => expand(true), true);
    return (values, prompt) => {
      expand(false);
      button.textContent = prompt;
      button.disabled = !values.length;
      panel.replaceChildren(...values.map((value) => {
        const option = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = fieldName;
        radio.value = value;
        radio.required = true;
        option.append(radio, value);
        return option;
      }));
    };
  }

  const districts = regionPicker('order-district', 'area', () => { selection = null; });
  const provinces = regionPicker('order-province', 'province', (province) => {
    selection = null;
    districts(Delivery.districtsFor(province), 'Elige tu distrito');
  });
  provinces(Delivery.provinces, 'Elige tu provincia');
  districts([], 'Elige una provincia primero');

  function useManualAddress() {
    if (widget) {
      const focused = document.activeElement === widget;
      fallback.value = widget.value || '';
      widget.remove();
      widget = null;
      fallback.hidden = fallback.disabled = false;
      label.htmlFor = fallback.id;
      if (focused) fallback.focus();
    }
    selection = null;
    help.textContent = 'Puedes escribir la dirección completa para la entrega.';
  }

  async function mountPlaces() {
    const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
    const input = new PlaceAutocompleteElement({
      includedRegionCodes: ['pa'], requestedLanguage: 'es', requestedRegion: 'pa',
      maxlength: fallback.maxLength, placeholder: 'Busca una calle, edificio o lugar',
      description: 'Dirección de entrega en Panamá',
    });
    const focused = document.activeElement === fallback;
    widget = input;
    input.id = 'google-order-address';
    label.htmlFor = input.id;
    input.value = fallback.value;
    input.setAttribute('aria-labelledby', label.id);
    input.setAttribute('aria-required', 'true');
    label.addEventListener('click', () => widget?.focus());
    input.addEventListener('gmp-error', useManualAddress, { once: true });
    input.addEventListener('input', () => {
      if (selection?.address !== input.value) selection = null;
      input.removeAttribute('aria-invalid');
      help.textContent = mapsHint;
    });
    input.addEventListener('gmp-select', ({ placePrediction }) => {
      const address = placePrediction.text.toString().slice(0, fallback.maxLength);
      input.value = address;
      selection = { address, placeId: placePrediction.placeId };
      input.removeAttribute('aria-invalid');
      help.textContent = mapsHint;
    });
    fallback.hidden = fallback.disabled = true;
    fallback.after(input);
    help.textContent = mapsHint;
    if (focused) input.focus();
  }

  function enableMaps(key) {
    if (!key || loading) return;
    loading = true;
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.search = new URLSearchParams({ key, v: 'weekly', loading: 'async', language: 'es', region: 'PA', callback: 'bellAromaPlacesReady' });
    const script = document.createElement('script');
    window.bellAromaPlacesReady = () => mountPlaces().catch(useManualAddress);
    window.gm_authFailure = useManualAddress;
    script.async = true;
    script.src = url.href;
    script.onerror = useManualAddress;
    document.head.append(script);
  }

  function addressData() {
    const address = (widget || fallback).value.trim();
    return { address, placeId: selection?.address === address ? selection.placeId : '' };
  }
  function validateAddress() {
    if (addressData().address) return true;
    help.textContent = 'Escribe la dirección de entrega.';
    (widget || fallback).setAttribute('aria-invalid', 'true');
    (widget || fallback).focus();
    return false;
  }
  fallback.addEventListener('input', () => {
    if (fallback.hasAttribute('aria-invalid')) {
      fallback.removeAttribute('aria-invalid');
      help.textContent = '';
    }
  });
  return { enableMaps, addressData, validateAddress };
}
