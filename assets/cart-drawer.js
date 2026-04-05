class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.discountStorageKey = 'cart-drawer-discount-code';

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.addEventListener('submit', this.handleSubmit.bind(this));
    this.addEventListener('input', this.handleInput.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  connectedCallback() {
    this.syncDiscountState();
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, () => this.syncDiscountState());
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) this.cartUpdateUnsubscriber();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink)
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    this.syncDiscountState();
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {this.classList.add('animate', 'active')});

    this.addEventListener('transitionend', () => {
      const containerToTrapFocusOn = this.classList.contains('is-empty') ? this.querySelector('.drawer__inner-empty') : document.getElementById('CartDrawer');
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      trapFocus(containerToTrapFocusOn, focusElement);
    }, { once: true });

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if(cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') && this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      const sectionElement = section.selector ? document.querySelector(section.selector) : document.getElementById(section.id);
      sectionElement.innerHTML =
          this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    }));
    this.syncDiscountState();

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer'
      },
      {
        id: 'cart-icon-bubble'
      }
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  handleInput(event) {
    if (!event.target.matches('[data-cart-discount-input]')) return;

    event.target.removeAttribute('aria-invalid');
    const discountContainer = event.target.closest('[data-cart-discount]');
    if (!discountContainer) return;
    this.updateDiscountMessage(discountContainer, '');
  }

  handleSubmit(event) {
    if (event.target.matches('[data-cart-discount-form]')) {
      event.preventDefault();
      this.saveDiscountCode(event.target);
      return;
    }

    if (event.target.id !== 'CartDrawer-Form') return;

    const submitter = event.submitter;
    if (!submitter || submitter.name !== 'checkout') return;

    const discountInput = this.querySelector('[data-cart-discount-input]');
    const discountCode = this.getNormalizedDiscountCode(
      discountInput ? discountInput.value : this.getStoredDiscountCode()
    );

    if (!discountCode) {
      this.clearStoredDiscountCode();
      return;
    }

    this.storeDiscountCode(discountCode);
    event.preventDefault();
    window.location.assign(
      `${window.shopUrl}/discount/${encodeURIComponent(discountCode)}?redirect=${encodeURIComponent('/checkout')}`
    );
  }

  saveDiscountCode(form) {
    const discountInput = form.querySelector('[data-cart-discount-input]');
    const discountContainer = form.closest('[data-cart-discount]');
    if (!discountInput || !discountContainer) return;

    const discountCode = this.getNormalizedDiscountCode(discountInput.value);

    if (!discountCode) {
      if (this.getStoredDiscountCode()) {
        this.clearStoredDiscountCode();
        this.updateDiscountMessage(discountContainer, 'Saved discount code removed.');
        return;
      }

      discountInput.setAttribute('aria-invalid', 'true');
      this.updateDiscountMessage(discountContainer, 'Enter a discount code first.', 'error');
      return;
    }

    discountInput.value = discountCode;
    discountInput.removeAttribute('aria-invalid');
    this.storeDiscountCode(discountCode);
    this.updateDiscountMessage(discountContainer, `Code "${discountCode}" saved. It will apply at checkout.`);
  }

  syncDiscountState() {
    const storedDiscountCode = this.getStoredDiscountCode();

    this.querySelectorAll('[data-cart-discount]').forEach((discountContainer) => {
      const discountInput = discountContainer.querySelector('[data-cart-discount-input]');
      if (discountInput) {
        discountInput.value = storedDiscountCode || '';
        discountInput.removeAttribute('aria-invalid');
      }

      this.updateDiscountMessage(
        discountContainer,
        storedDiscountCode ? `Code "${storedDiscountCode}" will apply at checkout.` : ''
      );
    });
  }

  updateDiscountMessage(discountContainer, message, status = '') {
    const messageElement = discountContainer.querySelector('[data-cart-discount-message]');
    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.hidden = !message;
    messageElement.classList.toggle('is-error', status === 'error');
  }

  getNormalizedDiscountCode(value) {
    return (value || '').trim();
  }

  getStoredDiscountCode() {
    try {
      return this.getNormalizedDiscountCode(window.localStorage.getItem(this.discountStorageKey));
    } catch (error) {
      return '';
    }
  }

  storeDiscountCode(value) {
    try {
      window.localStorage.setItem(this.discountStorageKey, value);
    } catch (error) {
      return;
    }
  }

  clearStoredDiscountCode() {
    try {
      window.localStorage.removeItem(this.discountStorageKey);
    } catch (error) {
      return;
    }
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner'
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      }
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
