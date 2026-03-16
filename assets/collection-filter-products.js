(() => {
  if (window.__collectionFilterProductsInitialized) return;
  window.__collectionFilterProductsInitialized = true;

  const instances = new WeakMap();

  class CollectionFilterProducts {
    constructor(section) {
      this.section = section;
      this.grid = section.querySelector('[data-collection-filter-grid]');
      this.buttons = Array.from(section.querySelectorAll('[data-collection-filter-button]'));
      this.items = Array.from(section.querySelectorAll('.collection-filter-products__item'));
      this.isotope = null;
    }

    init() {
      if (!this.grid || !this.items.length) return;
      this.bindButtons();
      this.waitForLibrary();
    }

    waitForLibrary(attempt = 0) {
      if (window.Isotope) {
        this.isotope = new window.Isotope(this.grid, {
          itemSelector: '.collection-filter-products__item',
          layoutMode: 'fitRows',
          percentPosition: true,
          transitionDuration: '0.35s'
        });

        this.observeImages();
        this.applyFilter(this.buttons.find((button) => button.classList.contains('is-active')) || this.buttons[0]);
        return;
      }

      if (attempt >= 20) {
        this.applyFilter(this.buttons.find((button) => button.classList.contains('is-active')) || this.buttons[0], true);
        return;
      }

      window.setTimeout(() => this.waitForLibrary(attempt + 1), 200);
    }

    bindButtons() {
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.applyFilter(button));
      });
    }

    applyFilter(button, fallbackOnly = false) {
      if (!button) return;

      const filterValue = button.dataset.filter || '*';

      this.buttons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      if (this.isotope && !fallbackOnly) {
        this.isotope.arrange({ filter: filterValue });
        return;
      }

      this.items.forEach((item) => {
        const shouldShow = filterValue === '*' || item.matches(filterValue);
        item.style.display = shouldShow ? '' : 'none';
      });
    }

    observeImages() {
      this.section.querySelectorAll('img').forEach((image) => {
        if (image.complete) return;
        image.addEventListener(
          'load',
          () => {
            if (this.isotope) this.isotope.layout();
          },
          { once: true }
        );
      });
    }
  }

  const initSections = (root = document) => {
    root.querySelectorAll('[data-collection-filter-products]').forEach((section) => {
      if (instances.has(section)) return;
      const instance = new CollectionFilterProducts(section);
      instances.set(section, instance);
      instance.init();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSections());
  } else {
    initSections();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initSections(event.target);
  });
})();
