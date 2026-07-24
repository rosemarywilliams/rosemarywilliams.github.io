document.documentElement.classList.add("can-reveal");

document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll("[data-menu-button]");

  navButtons.forEach((button) => {
    const menuId = button.getAttribute("aria-controls");
    const menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    button.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
      });
    });
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const featuredGallery = document.querySelector("[data-home-featured]");
  if (featuredGallery) {
    fetch("/api/art", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Featured artwork request failed with status ${response.status}.`);
        }
        return response.json();
      })
      .then((artworks) => {
        if (!Array.isArray(artworks)) return;

        const featured = artworks.filter((artwork) => artwork.featured);
        const featuredIds = new Set(featured.map((artwork) => artwork.id));
        const remaining = artworks.filter((artwork) => !featuredIds.has(artwork.id));
        const selection = [...featured, ...remaining].slice(0, 4);
        const cards = featuredGallery.querySelectorAll(".home-hero-work");

        selection.forEach((artwork, index) => {
          const card = cards[index];
          const image = card?.querySelector("img");
          const caption = card?.querySelector("figcaption");
          const source = artwork.thumbnailUrl || artwork.imageUrl;
          if (!card || !image || !caption || !source) return;

          image.src = source;
          image.alt = artwork.altText || artwork.title || "Artwork by Rosemary Williams";
          caption.textContent = artwork.title || "Untitled";
        });
      })
      .catch((error) => {
        console.warn("Using the home page's fallback featured artwork.", error);
      });
  }

  const revealItems = document.querySelectorAll(".soft-reveal");
  if ("IntersectionObserver" in window && revealItems.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
});
