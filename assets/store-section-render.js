class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    this.onFormInput = this.onFormInput.bind(this);
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);

    const facetForm = this.querySelector('form');
    if (facetForm) {
      facetForm.addEventListener('input', this.onFormInput);
    }

    const facetWrapper = this.querySelector('#FacetsWrapperDesktop');
    if (facetWrapper) facetWrapper.addEventListener('keyup', onKeyUpEscape);
  }

  onFormInput(event) {
    if (event.target.matches('[data-price-slider-input]')) return;
    this.debouncedOnSubmit(event);
  }

  static setListeners() {
    if (FacetFiltersForm.listenersBound) return;

    const onHistoryChange = (event) => {
      const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    };

    window.addEventListener('popstate', onHistoryChange);
    FacetFiltersForm.listenersBound = true;
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll('facet-remove a').forEach((element) => {
      element.classList.toggle('disabled', disable);
      element.setAttribute('aria-disabled', disable ? 'true' : 'false');
    });
  }

  static setLoadingState(isLoading) {
    const collection = document.getElementById('ProductGridContainer')?.querySelector('.collection');
    if (collection) {
      collection.classList.toggle('loading', isLoading);
    }

    ['ProductCount', 'ProductCountDesktop'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.toggle('loading', isLoading);
      }
    });
  }

  static buildSectionRenderUrl(sectionId, searchParams) {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('sections', sectionId);

    const params = new URLSearchParams(searchParams);
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;

    const sections = FacetFiltersForm.getSections();
    if (!sections.length) return;

    FacetFiltersForm.setLoadingState(true);

    const renderPromises = sections.map((section) => {
      const url = FacetFiltersForm.buildSectionRenderUrl(section.section, searchParams);
      const cachedSection = FacetFiltersForm.filterData.find((entry) => entry.url === url);

      if (cachedSection) {
        FacetFiltersForm.renderSection(cachedSection.html, event);
        return Promise.resolve();
      }

      return fetch(url)
        .then((response) => response.json())
        .then((responseJSON) => {
          const html = responseJSON[section.section];
          if (!html) return;

          FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
          FacetFiltersForm.renderSection(html, event);
        });
    });

    Promise.all(renderPromises)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        FacetFiltersForm.setLoadingState(false);
      });

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
  }

  static parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  static renderSection(html, event) {
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderProductGridContainer(html);
    FacetFiltersForm.renderProductCount(html);
  }

  static renderProductGridContainer(html) {
    const parsedHTML = FacetFiltersForm.parseHTML(html);
    const source = parsedHTML.getElementById('ProductGridContainer');
    const target = document.getElementById('ProductGridContainer');

    if (!source || !target) return;
    target.innerHTML = source.innerHTML;
  }

  static renderProductCount(html) {
    const parsedHTML = FacetFiltersForm.parseHTML(html);

    const sourceCount = parsedHTML.getElementById('ProductCount');
    const targetCount = document.getElementById('ProductCount');
    if (sourceCount && targetCount) {
      targetCount.innerHTML = sourceCount.innerHTML;
      targetCount.classList.remove('loading');
    }

    const sourceDesktopCount = parsedHTML.getElementById('ProductCountDesktop');
    const targetDesktopCount = document.getElementById('ProductCountDesktop');
    if (sourceDesktopCount && targetDesktopCount) {
      targetDesktopCount.innerHTML = sourceDesktopCount.innerHTML;
      targetDesktopCount.classList.remove('loading');
    } else if (sourceCount && targetDesktopCount) {
      targetDesktopCount.innerHTML = sourceCount.innerHTML;
      targetDesktopCount.classList.remove('loading');
    }
  }

  static renderFilters(html, event) {
    const parsedHTML = FacetFiltersForm.parseHTML(html);
    const facetDetailsElements = parsedHTML.querySelectorAll(
      '#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter'
    );

    const matchesIndex = (element) => {
      const jsFilter = event?.target?.closest('.js-filter');
      return jsFilter ? element.dataset.index === jsFilter.dataset.index : false;
    };

    const facetsToRender = Array.from(facetDetailsElements).filter((element) => !matchesIndex(element));
    const countsToRender = Array.from(facetDetailsElements).find(matchesIndex);

    facetsToRender.forEach((element) => {
      const target = document.querySelector(`.js-filter[data-index="${element.dataset.index}"]`);
      if (target) target.innerHTML = element.innerHTML;
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);

    if (countsToRender && event?.target) {
      const target = event.target.closest('.js-filter');
      if (target) FacetFiltersForm.renderCounts(countsToRender, target);
    }
  }

  static renderActiveFacets(parsedHTML) {
    ['.active-facets-mobile', '.active-facets-desktop'].forEach((selector) => {
      const source = parsedHTML.querySelector(selector);
      const target = document.querySelector(selector);

      if (!source || !target) return;
      target.innerHTML = source.innerHTML;
    });

    FacetFiltersForm.toggleActiveFacets(false);
  }

  static renderAdditionalElements(parsedHTML) {
    ['.mobile-facets__open', '.mobile-facets__count', '.sorting'].forEach((selector) => {
      const source = parsedHTML.querySelector(selector);
      const target = document.querySelector(selector);

      if (!source || !target) return;
      target.innerHTML = source.innerHTML;
    });

    const mobileForm = document.getElementById('FacetFiltersFormMobile');
    const menuDrawer = mobileForm?.closest('menu-drawer');
    if (menuDrawer && typeof menuDrawer.bindEvents === 'function') {
      menuDrawer.bindEvents();
    }
  }

  static renderCounts(source, target) {
    const sourceSelected = source.querySelector('.facets__selected');
    const targetSelected = target.querySelector('.facets__selected');
    if (sourceSelected && targetSelected) {
      targetSelected.outerHTML = sourceSelected.outerHTML;
    }

    const sourceSummary = source.querySelector('.facets__summary');
    const targetSummary = target.querySelector('.facets__summary');
    if (sourceSummary && targetSummary) {
      targetSummary.outerHTML = sourceSummary.outerHTML;
    }
  }

  static updateURLHash(searchParams) {
    history.pushState(
      { searchParams },
      '',
      `${window.location.pathname}${searchParams ? `?${searchParams}` : ''}`
    );
  }

  static getSections() {
    const productGrid = document.getElementById('product-grid');
    return productGrid ? [{ section: productGrid.dataset.id }] : [];
  }

  createSearchParams(form) {
    return new URLSearchParams(new FormData(form)).toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();

    const sortFilterForms = document.querySelectorAll('facet-filters-form form');
    const isMobileCheckbox = event.target?.classList?.contains('mobile-facets__checkbox');

    if (isMobileCheckbox) {
      const searchParams = this.createSearchParams(event.target.closest('form'));
      this.onSubmitForm(searchParams, event);
      return;
    }

    const forms = [];
    const isMobileForm = event.target?.closest('form')?.id === 'FacetFiltersFormMobile';

    sortFilterForms.forEach((form) => {
      if (!isMobileForm) {
        if (form.id === 'FacetSortForm' || form.id === 'FacetFiltersForm' || form.id === 'FacetSortDrawerForm') {
          document.querySelectorAll('.no-js-list').forEach((element) => element.remove());
          forms.push(this.createSearchParams(form));
        }
        return;
      }

      if (form.id === 'FacetFiltersFormMobile') {
        forms.push(this.createSearchParams(form));
      }
    });

    this.onSubmitForm(forms.join('&'), event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.toggleActiveFacets();
    const url =
      event.currentTarget.href.indexOf('?') === -1
        ? ''
        : event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
    FacetFiltersForm.renderPage(url);
  }
}

FacetFiltersForm.filterData = [];
FacetFiltersForm.listenersBound = false;
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);

if (!customElements.get('facet-filters-form')) {
  customElements.define('facet-filters-form', FacetFiltersForm);
}
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
  constructor() {
    super();

    this.minimumBound = 0;
    this.maximumBound = this.parseValue(this.dataset.rangeMax, 0);
    this.decimals = this.getDecimalPlaces(this.dataset.rangeStep || '0.01');
    this.currencySymbol = this.dataset.currencySymbol || '$';

    this.minimumInput = this.querySelector('[data-price-input="min"]');
    this.maximumInput = this.querySelector('[data-price-input="max"]');
    this.minimumSlider = this.querySelector('[data-price-slider-input="min"]');
    this.maximumSlider = this.querySelector('[data-price-slider-input="max"]');
    this.progressBar = this.querySelector('[data-price-slider-progress]');
    this.sliderContainer = this.querySelector('.price-range-slider');
    this.minimumDisplay = this.querySelector('[data-price-display="min"]');
    this.maximumDisplay = this.querySelector('[data-price-display="max"]');
    this.onWindowResize = this.updateProgress.bind(this);

    [this.minimumInput, this.maximumInput].forEach((input) => {
      if (input) input.disabled = false;
    });

    [this.minimumInput, this.maximumInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', this.onTextInput.bind(this));
      input.addEventListener('change', this.onTextInput.bind(this));
    });

    [this.minimumSlider, this.maximumSlider].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', this.onSliderInput.bind(this));
      input.addEventListener('change', this.onSliderChange.bind(this));
    });

    this.syncSlidersFromInputs();
    this.updateProgress();
    window.addEventListener('resize', this.onWindowResize);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.onWindowResize);
  }

  parseValue(value, fallback) {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  getDecimalPlaces(value) {
    return value.includes('.') ? value.split('.')[1].length : 0;
  }

  formatValue(value) {
    return Number(Number(value).toFixed(this.decimals)).toString();
  }

  formatCurrency(value) {
    const amount = Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: this.decimals,
    });

    return `${this.currencySymbol}${amount}`;
  }

  getNormalizedValues(source) {
    let minimumValue =
      source === 'slider'
        ? this.parseValue(this.minimumSlider?.value, this.minimumBound)
        : this.minimumInput?.value === ''
          ? this.minimumBound
          : this.parseValue(this.minimumInput.value, this.minimumBound);

    let maximumValue =
      source === 'slider'
        ? this.parseValue(this.maximumSlider?.value, this.maximumBound)
        : this.maximumInput?.value === ''
          ? this.maximumBound
          : this.parseValue(this.maximumInput.value, this.maximumBound);

    minimumValue = Math.max(this.minimumBound, Math.min(minimumValue, this.maximumBound));
    maximumValue = Math.max(this.minimumBound, Math.min(maximumValue, this.maximumBound));

    if (minimumValue > maximumValue) {
      if (this.lastChanged === 'min') {
        maximumValue = minimumValue;
      } else {
        minimumValue = maximumValue;
      }
    }

    return {
      minimumValue,
      maximumValue,
    };
  }

  syncSlidersFromInputs() {
    if (!this.minimumSlider || !this.maximumSlider) return;

    const { minimumValue, maximumValue } = this.getNormalizedValues('input');

    this.minimumSlider.value = this.formatValue(minimumValue);
    this.maximumSlider.value = this.formatValue(maximumValue);

    if (this.minimumInput && this.minimumInput.value !== '') {
      this.minimumInput.value = this.formatValue(minimumValue);
    }

    if (this.maximumInput && this.maximumInput.value !== '') {
      this.maximumInput.value = this.formatValue(maximumValue);
    }
  }

  syncInputsFromSliders() {
    const { minimumValue, maximumValue } = this.getNormalizedValues('slider');

    this.minimumSlider.value = this.formatValue(minimumValue);
    this.maximumSlider.value = this.formatValue(maximumValue);

    if (this.minimumInput) {
      this.minimumInput.value = minimumValue > this.minimumBound ? this.formatValue(minimumValue) : '';
    }

    if (this.maximumInput) {
      this.maximumInput.value = maximumValue < this.maximumBound ? this.formatValue(maximumValue) : '';
    }
  }

  updateDisplays() {
    if (!this.sliderContainer || !this.minimumDisplay || !this.maximumDisplay) return;

    const minimumValue = this.parseValue(this.minimumSlider?.value, this.minimumBound);
    const maximumValue = this.parseValue(this.maximumSlider?.value, this.maximumBound);
    const range = this.maximumBound - this.minimumBound;
    const sliderWidth = this.sliderContainer.clientWidth;
    if (!sliderWidth) return;

    this.minimumDisplay.textContent = this.formatCurrency(minimumValue);
    this.maximumDisplay.textContent = this.formatCurrency(maximumValue);

    [
      { element: this.minimumDisplay, value: minimumValue },
      { element: this.maximumDisplay, value: maximumValue },
    ].forEach(({ element, value }) => {
      const percent = range === 0 ? 0 : (value - this.minimumBound) / range;
      const rawPosition = percent * sliderWidth;
      const halfWidth = element.offsetWidth / 2;
      const clampedPosition = Math.min(Math.max(rawPosition, halfWidth), sliderWidth - halfWidth);
      element.style.left = `${clampedPosition}px`;
    });
  }

  updateProgress() {
    if (!this.minimumSlider || !this.maximumSlider) return;

    const minimumValue = this.parseValue(this.minimumSlider.value, this.minimumBound);
    const maximumValue = this.parseValue(this.maximumSlider.value, this.maximumBound);
    const range = this.maximumBound - this.minimumBound;

    if (this.progressBar && range > 0) {
      const left = ((minimumValue - this.minimumBound) / range) * 100;
      const right = ((maximumValue - this.minimumBound) / range) * 100;

      this.progressBar.style.left = `${left}%`;
      this.progressBar.style.width = `${Math.max(right - left, 0)}%`;
    }

    this.updateDisplays();
  }

  onTextInput(event) {
    this.lastChanged = event.currentTarget.dataset.priceInput;
    this.syncSlidersFromInputs();
    this.updateProgress();
  }

  onSliderInput(event) {
    event.stopPropagation();
    this.lastChanged = event.currentTarget.dataset.priceSliderInput;
    this.syncInputsFromSliders();
    this.updateProgress();
  }

  onSliderChange(event) {
    event.stopPropagation();
    this.lastChanged = event.currentTarget.dataset.priceSliderInput;
    this.syncInputsFromSliders();
    this.updateProgress();

    const triggerInput = this.lastChanged === 'min' ? this.minimumInput : this.maximumInput;
    if (triggerInput) {
      triggerInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

if (!customElements.get('price-range')) {
  customElements.define('price-range', PriceRange);
}

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    const facetLink = this.querySelector('a');
    if (!facetLink) return;

    facetLink.setAttribute('role', 'button');
    facetLink.addEventListener('click', this.closeFilter.bind(this));
    facetLink.addEventListener('keyup', (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
    });
  }

  closeFilter(event) {
    event.preventDefault();
    const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
    if (form) form.onActiveFilterClick(event);
  }
}

if (!customElements.get('facet-remove')) {
  customElements.define('facet-remove', FacetRemove);
}
