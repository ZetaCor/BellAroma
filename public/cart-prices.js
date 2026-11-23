// Prices from the admin can contain currency labels or free-form consultation text.
const CartPrices = (() => {
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function cents(price) {
    const match = /^(?:US\$|USD|B\/\.|\$)?\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*(?:USD)?$/i.exec(String(price ?? '').trim());
    return match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : null;
  }
  function total(lines) {
    let sum = 0;
    for (const { product, quantity } of lines) {
      const unit = cents(product.price);
      if (unit === null) return null;
      sum += unit * quantity;
      if (!Number.isSafeInteger(sum)) return null;
    }
    return sum;
  }
  const format = (value) => value === null ? 'Por confirmar' : currency.format(value / 100);
  return { total, format };
})();

if (typeof module !== 'undefined') module.exports = CartPrices;
