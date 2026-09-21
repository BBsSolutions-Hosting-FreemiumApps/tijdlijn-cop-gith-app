/*!
 * CompactTimeline — een lichtgewicht, framework-loze verticale tijdlijn-widget.
 * Eigen, originele implementatie (geen code/CSS/branding overgenomen van derden).
 * Geen dependencies. Werkt in elke moderne browser.
 */
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.CompactTimeline = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULTS = {
    data: null,          // array met items (heeft voorrang op dataUrl)
    dataUrl: null,       // pad naar een JSON-bestand met items
    perPage: 4,          // aantal items per "pagina" (laad-meer stap)
    skin: 'light',       // 'light' | 'dark'
    animate: true,       // fade/slide animatie bij scrollen in beeld
    showFilter: true,    // toon categorie-dropdown boven de tijdlijn
    locale: 'nl-NL',     // locale voor datumlabels
    linkTarget: '_self', // target voor items met een 'url'
    texts: {
      readMore: 'Lees meer',
      readLess: 'Lees minder',
      loadMore: 'Laad meer',
      allCategories: 'Alle categorieën',
      empty: 'Geen items gevonden.'
    }
  };

  var instanceCounter = 0;

  function mergeDeep(target, source) {
    var out = Object.assign({}, target);
    if (source) {
      Object.keys(source).forEach(function (key) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key] &&
          typeof target[key] === 'object'
        ) {
          out[key] = mergeDeep(target[key], source[key]);
        } else if (source[key] !== undefined) {
          out[key] = source[key];
        }
      });
    }
    return out;
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatMarker(dateStr, locale) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { month: '', day: '', full: String(dateStr || '') };
    }
    var month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
    var day = new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(d);
    var full = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
    return { month: month.replace('.', ''), day: day, full: full, sortValue: d.getTime() };
  }

  function CompactTimeline(selector, options) {
    this.root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!this.root) {
      throw new Error('CompactTimeline: geen container gevonden voor selector "' + selector + '"');
    }

    this.options = mergeDeep(DEFAULTS, options || {});
    this.uid = 'ct-' + (++instanceCounter);

    this.items = [];
    this.filteredItems = [];
    this.activeCategory = 'all';
    this.visibleCount = this.options.perPage;
    this._observer = null;
    this._expanded = Object.create(null);
    this._boundLoadMore = this._onLoadMoreClick.bind(this);
    this._boundFilterChange = this._onFilterChange.bind(this);
    this._boundListClick = this._onListClick.bind(this);

    this._buildShell();
    this._loadData();
  }

  CompactTimeline.prototype._buildShell = function () {
    this.root.classList.add('ct-timeline');
    this._applySkin();
    this.root.innerHTML =
      '<div class="ct-timeline__filter-bar" hidden></div>' +
      '<div class="ct-timeline__track">' +
      '<ul class="ct-timeline__list"></ul>' +
      '</div>' +
      '<p class="ct-timeline__empty" hidden></p>' +
      '<div class="ct-timeline__footer">' +
      '<button type="button" class="ct-timeline__load-more">' + escapeHtml(this.options.texts.loadMore) + '</button>' +
      '</div>';

    this.filterBarEl = this.root.querySelector('.ct-timeline__filter-bar');
    this.listEl = this.root.querySelector('.ct-timeline__list');
    this.emptyEl = this.root.querySelector('.ct-timeline__empty');
    this.footerEl = this.root.querySelector('.ct-timeline__footer');
    this.loadMoreBtn = this.root.querySelector('.ct-timeline__load-more');

    this.emptyEl.textContent = this.options.texts.empty;
    this.loadMoreBtn.addEventListener('click', this._boundLoadMore);
    this.listEl.addEventListener('click', this._boundListClick);
  };

  CompactTimeline.prototype._applySkin = function () {
    this.root.classList.remove('ct-timeline--light', 'ct-timeline--dark');
    this.root.classList.add(this.options.skin === 'dark' ? 'ct-timeline--dark' : 'ct-timeline--light');
  };

  CompactTimeline.prototype.setSkin = function (skin) {
    this.options.skin = skin === 'dark' ? 'dark' : 'light';
    this._applySkin();
  };

  CompactTimeline.prototype._loadData = function () {
    var self = this;
    if (Array.isArray(this.options.data)) {
      this._onDataReady(this.options.data);
      return;
    }
    if (this.options.dataUrl) {
      fetch(this.options.dataUrl)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) {
          self._onDataReady(Array.isArray(json) ? json : []);
        })
        .catch(function (err) {
          console.error('CompactTimeline: kon data niet laden van "' + self.options.dataUrl + '"', err);
          self._onDataReady([]);
        });
      return;
    }
    this._onDataReady([]);
  };

  CompactTimeline.prototype._onDataReady = function (items) {
    this.items = items.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    this._renderFilterBar();
    this.filterByCategory('all');
  };

  CompactTimeline.prototype._collectCategories = function () {
    var seen = Object.create(null);
    var list = [];
    this.items.forEach(function (item) {
      if (item.category && !seen[item.category]) {
        seen[item.category] = true;
        list.push(item.category);
      }
    });
    return list;
  };

  CompactTimeline.prototype._renderFilterBar = function () {
    var categories = this._collectCategories();
    if (!this.options.showFilter || categories.length === 0) {
      this.filterBarEl.hidden = true;
      this.filterBarEl.innerHTML = '';
      return;
    }

    var selectId = this.uid + '-filter';
    var html = '<label class="ct-timeline__filter-label" for="' + selectId + '">' +
      escapeHtml(this.options.texts.allCategories) + '</label>' +
      '<select class="ct-timeline__filter-select" id="' + selectId + '">' +
      '<option value="all">' + escapeHtml(this.options.texts.allCategories) + '</option>';

    categories.forEach(function (cat) {
      html += '<option value="' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</option>';
    });
    html += '</select>';

    this.filterBarEl.innerHTML = html;
    this.filterBarEl.hidden = false;
    this.filterSelect = this.filterBarEl.querySelector('.ct-timeline__filter-select');
    this.filterSelect.addEventListener('change', this._boundFilterChange);
  };

  CompactTimeline.prototype._onFilterChange = function (event) {
    this.filterByCategory(event.target.value);
  };

  CompactTimeline.prototype.filterByCategory = function (category) {
    this.activeCategory = category || 'all';
    this.visibleCount = this.options.perPage;
    this.filteredItems = this.activeCategory === 'all'
      ? this.items.slice()
      : this.items.filter(function (item) { return item.category === this.activeCategory; }, this);
    this._render();
  };

  CompactTimeline.prototype.loadMore = function () {
    this.visibleCount += this.options.perPage;
    this._render();
  };

  CompactTimeline.prototype._onLoadMoreClick = function () {
    this.loadMore();
  };

  CompactTimeline.prototype._onListClick = function (event) {
    var toggleBtn = event.target.closest('.ct-timeline__more');
    if (toggleBtn) {
      var index = toggleBtn.getAttribute('data-index');
      this._toggleExpand(index, toggleBtn);
    }
  };

  CompactTimeline.prototype._toggleExpand = function (index, buttonEl) {
    var li = this.listEl.querySelector('.ct-timeline__item[data-index="' + index + '"]');
    if (!li) return;
    var contentEl = li.querySelector('.ct-timeline__content');
    var isOpen = this._expanded[index] === true;
    this._expanded[index] = !isOpen;
    if (contentEl) contentEl.hidden = isOpen;
    buttonEl.setAttribute('aria-expanded', String(!isOpen));
    buttonEl.textContent = !isOpen ? this.options.texts.readLess : this.options.texts.readMore;
  };

  CompactTimeline.prototype._render = function () {
    var visibleItems = this.filteredItems.slice(0, this.visibleCount);
    this.listEl.innerHTML = visibleItems.map(this._itemTemplate, this).join('');

    var hasMore = this.visibleCount < this.filteredItems.length;
    this.footerEl.hidden = !hasMore;

    var isEmpty = this.filteredItems.length === 0;
    this.emptyEl.hidden = !isEmpty;
    this.listEl.hidden = isEmpty;

    this._setupAnimation();
  };

  CompactTimeline.prototype._itemTemplate = function (item, i) {
    var marker = formatMarker(item.date, this.options.locale);
    var side = i % 2 === 0 ? 'left' : 'right';
    var imageHtml = item.image
      ? '<img class="ct-timeline__image" src="' + escapeHtml(item.image) + '" alt="" loading="lazy">'
      : '';

    var titleHtml = item.url
      ? '<a class="ct-timeline__title-link" href="' + escapeHtml(item.url) + '" target="' + escapeHtml(this.options.linkTarget) + '" rel="noopener">' + escapeHtml(item.title) + '</a>'
      : escapeHtml(item.title);

    var isExpanded = this._expanded[i] === true;
    var actionHtml = '';
    if (item.url) {
      actionHtml = '<a class="ct-timeline__more" href="' + escapeHtml(item.url) + '" target="' + escapeHtml(this.options.linkTarget) + '" rel="noopener">' +
        escapeHtml(this.options.texts.readMore) + '</a>';
    } else if (item.content) {
      actionHtml = '<button type="button" class="ct-timeline__more" data-index="' + i + '" aria-expanded="' + isExpanded + '">' +
        escapeHtml(isExpanded ? this.options.texts.readLess : this.options.texts.readMore) + '</button>' +
        '<div class="ct-timeline__content"' + (isExpanded ? '' : ' hidden') + '>' + escapeHtml(item.content) + '</div>';
    }

    var categoryHtml = item.category
      ? '<span class="ct-timeline__category">' + escapeHtml(item.category) + '</span>'
      : '';

    return (
      '<li class="ct-timeline__item ct-timeline__item--' + side + '" data-index="' + i + '" data-category="' + escapeHtml(item.category || '') + '">' +
      '<div class="ct-timeline__marker" title="' + escapeHtml(marker.full) + '">' +
      '<span class="ct-timeline__marker-month">' + escapeHtml(marker.month) + '</span>' +
      '<span class="ct-timeline__marker-day">' + escapeHtml(marker.day) + '</span>' +
      '</div>' +
      '<div class="ct-timeline__card">' +
      categoryHtml +
      imageHtml +
      '<h3 class="ct-timeline__title">' + titleHtml + '</h3>' +
      '<p class="ct-timeline__excerpt">' + escapeHtml(item.excerpt) + '</p>' +
      actionHtml +
      '</div>' +
      '</li>'
    );
  };

  CompactTimeline.prototype._setupAnimation = function () {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    var items = this.listEl.querySelectorAll('.ct-timeline__item');
    if (!this.options.animate || typeof IntersectionObserver === 'undefined') {
      items.forEach(function (el) { el.classList.add('ct-timeline__item--visible'); });
      return;
    }

    this._observer = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ct-timeline__item--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { this._observer.observe(el); }, this);
  };

  CompactTimeline.prototype.destroy = function () {
    if (this._observer) this._observer.disconnect();
    this.loadMoreBtn.removeEventListener('click', this._boundLoadMore);
    this.listEl.removeEventListener('click', this._boundListClick);
    if (this.filterSelect) this.filterSelect.removeEventListener('change', this._boundFilterChange);
    this.root.innerHTML = '';
    this.root.classList.remove('ct-timeline', 'ct-timeline--light', 'ct-timeline--dark');
  };

  return CompactTimeline;
});
