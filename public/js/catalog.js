document.querySelectorAll('.architecture-carousel').forEach((carousel) => {
  const slides = Array.from(carousel.querySelectorAll('.architecture-slide'));
  const counter = carousel.querySelector('.architecture-counter');
  let current = 0;
  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, index) => { slide.hidden = index !== current; });
    carousel.querySelectorAll('[data-slide]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.slide) === current));
    });
    counter.textContent = `${current + 1} / ${slides.length}`;
  }
  function move(direction) { show(current + direction); }
  carousel.querySelectorAll('[data-slide]').forEach((button) => {
    button.addEventListener('click', () => show(Number(button.dataset.slide)));
  });
  carousel.querySelectorAll('[data-direction]').forEach((button) => {
    button.addEventListener('click', () => move(Number(button.dataset.direction)));
  });
  carousel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
});
