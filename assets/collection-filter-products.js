(() => {
  if (window.__collectionFilterProductsInitialized) return;
  window.__collectionFilterProductsInitialized = true;

  const instances = new WeakMap();

  class CollectionFilterProducts {
    constructor(section) {
      this.section = section;
      this.grid = section.querySelector('[data-collection-filter-grid]');
      this.buttons = Array.from(section.querySelectorAll('[data-collection-filter-button]'));
      this.items = Array.from(section.querySelectorAll('[data-collection-filter-item]'));
      this.quickAddButtons = Array.from(section.querySelectorAll('[data-collection-filter-add]'));
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    }

    init() {
      if (!this.grid || !this.items.length) return;
      this.bindButtons();
      this.bindQuickAddButtons();
      this.applyFilter(this.buttons.find((button) => button.classList.contains('is-active')) || this.buttons[0]);
    }

    bindButtons() {
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.applyFilter(button));
      });
    }

    bindQuickAddButtons() {
      this.quickAddButtons.forEach((button) => {
        button.addEventListener('click', () => this.addToCart(button));
      });
    }

    addToCart(button) {
      const variantId = button.dataset.variantId;
      if (!variantId || button.getAttribute('aria-disabled') === 'true' || button.disabled) return;

      this.setQuickAddState(button, true);

      const requestBody = {
        items: [
          {
            id: Number(variantId),
            quantity: 1
          }
        ]
      };

      if (this.cart) {
        requestBody.sections = this.cart.getSectionsToRender().map((section) => section.id);
        requestBody.sections_url = window.location.pathname;
        this.cart.setActiveElement(button);
      }

      const config = fetchConfig('json');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      config.body = JSON.stringify(requestBody);

      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'collection-filter-products',
              productVariantId: variantId,
              errors: response.description,
              message: response.message
            });
            throw new Error(response.description || response.message || window.cartStrings.error);
          }

          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'collection-filter-products',
            productVariantId: variantId
          });

          if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }

          this.cart.renderContents(response);
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          if (this.cart && this.cart.classList.contains('is-empty')) {
            this.cart.classList.remove('is-empty');
          }

          this.setQuickAddState(button, false);
        });
    }

    setQuickAddState(button, isLoading) {
      button.classList.toggle('loading', isLoading);
      button.toggleAttribute('aria-disabled', isLoading);
      button.disabled = isLoading;

      const spinner = button.querySelector('.loading-overlay__spinner');
      if (spinner) {
        spinner.classList.toggle('hidden', !isLoading);
      }
    }

    applyFilter(button) {
      if (!button) return;

      const filterValue = button.dataset.filter || '*';

      this.buttons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      this.items.forEach((item) => {
        const shouldShow = filterValue === '*' || item.dataset.filterGroup === filterValue;
        item.style.display = shouldShow ? '' : 'none';
        item.style.position = '';
        item.style.left = '';
        item.style.top = '';
        item.style.transform = '';
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
