const status = document.querySelector('#product-stock');
const retry = document.querySelector('#retry-stock');
const add = document.querySelector('#add-product');

async function loadStock() {
  retry.hidden = true;
  add.disabled = true;
  status.textContent = 'Consultando disponibilidad…';
  status.className = 'stock';
  try {
    const response = await fetch(status.dataset.url, { cache: 'no-store' });
    if (response.status === 404) {
      status.textContent = 'Sin stock';
      status.classList.add('out-stock');
      return;
    }
    if (!response.ok) throw new Error('Stock request failed');
    const { stock } = await response.json();
    if (!Number.isFinite(stock)) throw new Error('Invalid stock');
    const available = stock > 0;
    status.textContent = available ? 'Disponible' : 'Sin stock';
    status.classList.add(available ? 'in-stock' : 'out-stock');
    add.disabled = !available;
  } catch {
    status.textContent = 'Disponibilidad sin confirmar.';
    retry.hidden = false;
  }
}

retry.addEventListener('click', loadStock);
loadStock();
