(() => {
  if (window.__testimonialsShowcaseInitialized) return;
  window.__testimonialsShowcaseInitialized = true;

  const instances = new WeakMap();

  class TestimonialsShowcase {
    constructor(section) {
      this.section = section;
      this.slider = section.querySelector('[data-testimonials-slider]');
      this.pagination = section.querySelector('[data-testimonials-pagination]');
      this.nextButton = section.querySelector('[data-testimonials-next]');
      this.prevButton = section.querySelector('[data-testimonials-prev]');
      this.swiper = null;
    }

    init() {
      if (!this.slider || !window.Swiper) return;

      const desktopSlides = Number.parseInt(this.slider.dataset.desktopSlides || '3', 10);

      this.swiper = new window.Swiper(this.slider, {
        slidesPerView: 1,
        spaceBetween: 20,
        speed: 600,
        rewind: true,
        watchOverflow: true,
        pagination: {
          el: this.pagination,
          clickable: true
        },
        navigation: {
          nextEl: this.nextButton,
          prevEl: this.prevButton
        },
        breakpoints: {
          750: {
            slidesPerView: 2,
            spaceBetween: 22
          },
          990: {
            slidesPerView: desktopSlides,
            spaceBetween: 24
          }
        }
      });
    }

    destroy() {
      if (!this.swiper) return;
      this.swiper.destroy(true, true);
      this.swiper = null;
    }
  }

  const initSections = (root = document) => {
    root.querySelectorAll('[data-testimonials-showcase]').forEach((section) => {
      if (instances.has(section)) return;

      const instance = new TestimonialsShowcase(section);
      instances.set(section, instance);
      instance.init();
    });
  };

  const destroySection = (root) => {
    root.querySelectorAll('[data-testimonials-showcase]').forEach((section) => {
      const instance = instances.get(section);
      if (!instance) return;
      instance.destroy();
      instances.delete(section);
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

  document.addEventListener('shopify:section:unload', (event) => {
    destroySection(event.target);
  });
})();
