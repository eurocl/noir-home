document.querySelectorAll('.checkout-confirm').forEach(form => {
  form.addEventListener('submit', event => {
    if (form.dataset.submitting) { event.preventDefault(); return; }
    form.dataset.submitting = 'true';
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Confirmando, esperá un momento…';
  });
});
window.addEventListener('pageshow', () => {
  document.querySelectorAll('.checkout-confirm').forEach(form => {
    delete form.dataset.submitting;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    button.textContent = form.action.endsWith('/retry') ? 'Retomar este pedido' : 'Confirmar compra de demostración';
  });
});
