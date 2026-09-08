const categoryButtons = document.querySelectorAll("button[data-filter]");
const productCards = document.querySelectorAll("#product-grid .product-card");
const filterStatus = document.getElementById("filter-status");
const emptyCategory = document.getElementById("empty-category");

function filterProducts(button) {
  const category = button.dataset.filter;
  let count = 0;

  productCards.forEach((card) => {
    card.hidden = category !== "all" && card.dataset.category !== category;
    if (!card.hidden) count += 1;
  });

  categoryButtons.forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  const label = category === "all" ? "All categories" : button.textContent.trim();
  filterStatus.textContent = `${label} · ${count} ${count === 1 ? "product" : "products"}`;
  emptyCategory.hidden = count !== 0;
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => filterProducts(button));
});

filterProducts(document.querySelector('button[data-filter="all"]'));
