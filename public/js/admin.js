document.querySelectorAll('.noir-admin form').forEach(form => {
  form.addEventListener('submit', event => {
    if (form.dataset.pending) return event.preventDefault();
    form.dataset.pending = 'true';
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Procesando…';
  });
});
window.addEventListener('pageshow', () => {
  document.querySelectorAll('form[data-pending]').forEach(form => {
    delete form.dataset.pending;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    button.textContent = form.classList.contains('admin-form') ? 'Crear producto' : 'Eliminar definitivamente';
  });
});
