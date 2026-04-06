(() => {
  if (window.__collectionFilterProductsInitialized) return;
  window.__collectionFilterProductsInitialized = true;

  const instances = new WeakMap();

  const getScopedMatches = (root, selector) => {
    const matches = [];

    if (root instanceof Element && root.matches(selector)) {
      matches.push(root);
    }

    if (root && typeof root.querySelectorAll === 'function') {
      matches.push(...root.querySelectorAll(selector));
    }

    return matches;
  };

  const getCart = () => document.querySelector('cart-notification') || document.querySelector('cart-drawer');

  const setQuickAddState = (button, isLoading) => {
    button.classList.toggle('loading', isLoading);
    button.toggleAttribute('aria-disabled', isLoading);
    button.disabled = isLoading;

    const spinner = button.querySelector('.loading-overlay__spinner');
    if (spinner) {
      spinner.classList.toggle('hidden', !isLoading);
    }
  };

  const addToCart = (button) => {
    const variantId = button.dataset.variantId;
    if (!variantId || button.getAttribute('aria-disabled') === 'true' || button.disabled) return;

    const cart = getCart();
    const source = button.dataset.source || 'collection-product-card';

    setQuickAddState(button, true);

    const requestBody = {
      items: [
        {
          id: Number(variantId),
          quantity: 1,
        },
      ],
    };

    if (cart) {
      requestBody.sections = cart.getSectionsToRender().map((section) => section.id);
      requestBody.sections_url = window.location.pathname;
      cart.setActiveElement(button);
    }

    const config = fetchConfig('json');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    config.body = JSON.stringify(requestBody);

    fetch(`${routes.cart_add_url}`, config)
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          publish(PUB_SUB_EVENTS.cartError, {
            source,
            productVariantId: variantId,
            errors: response.description,
            message: response.message,
          });
          throw new Error(response.description || response.message || window.cartStrings.error);
        }

        publish(PUB_SUB_EVENTS.cartUpdate, {
          source,
          productVariantId: variantId,
        });

        if (!cart) {
          window.location = window.routes?.cart_url || routes.cart_url;
          return;
        }

        cart.renderContents(response);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (cart && cart.classList.contains('is-empty')) {
          cart.classList.remove('is-empty');
        }

        setQuickAddState(button, false);
      });
  };

  const initializeCollectionProductCards = (root = document) => {
    getScopedMatches(root, '[data-collection-product-card-add]').forEach((button) => {
      if (button.dataset.collectionProductCardBound === 'true') return;

      button.dataset.collectionProductCardBound = 'true';
      button.addEventListener('click', () => addToCart(button));
    });
  };

  window.initializeCollectionProductCards = initializeCollectionProductCards;

  class CollectionFilterProducts {
    constructor(section) {
      this.section = section;
      this.grid = section.querySelector('[data-collection-filter-grid]');
      this.buttons = Array.from(section.querySelectorAll('[data-collection-filter-button]'));
      this.items = Array.from(section.querySelectorAll('[data-collection-filter-item]'));
    }

    init() {
      if (!this.grid || !this.items.length) return;
      this.bindButtons();
      this.applyFilter(this.buttons.find((button) => button.classList.contains('is-active')) || this.buttons[0]);
    }

    bindButtons() {
      this.buttons.forEach((button) => {
        button.addEventListener('click', () => this.applyFilter(button));
      });
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
    getScopedMatches(root, '[data-collection-filter-products]').forEach((section) => {
      if (instances.has(section)) return;
      const instance = new CollectionFilterProducts(section);
      instances.set(section, instance);
      instance.init();
    });

    initializeCollectionProductCards(root);
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
