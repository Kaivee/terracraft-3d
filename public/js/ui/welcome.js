import { SearchBar } from './search.js';
import { loadPlaces, savePlaces } from '../core/settings.js';

export class Welcome {
  constructor({ container, store, toasts, onSearch, onMyLocation, onRandom }) {
    this.container = container;
    this.store = store;
    this.toasts = toasts;
    this._onSearch = onSearch;
    this._onMyLocation = onMyLocation;
    this._onRandom = onRandom || null;
    this._dismissed = false;
    this._savedList = null;

    this._build();
    this._buildSaved();
  }

  _build() {
    this.container.textContent = '';

    const card = document.createElement('div');
    card.className = 'welcome-card';

    const brand = document.createElement('div');
    brand.className = 'welcome-brand';

    const icon = document.createElement('svg');
    icon.className = 'icon welcome-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<use href="#icon-mountain"/>';

    const title = document.createElement('h1');
    title.className = 'welcome-title';
    title.textContent = 'TERRACRAFT';

    const tagline = document.createElement('p');
    tagline.className = 'welcome-tagline';
    tagline.textContent = 'Search any place on Earth and step into it — orbit, walk, measure, and share.';

    brand.append(icon, title, tagline);

    const search = document.createElement('div');
    search.className = 'welcome-search';
    new SearchBar({
      container: search,
      store: this.store,
      toasts: this.toasts,
      onSearch: (lat, lon, opts) => this._onSearch(lat, lon, opts),
    });

    const famous = document.createElement('section');
    famous.className = 'welcome-famous';
    const famousHead = document.createElement('h2');
    famousHead.textContent = 'Famous spots';
    const chips = document.createElement('div');
    chips.className = 'welcome-chips';
    for (const spot of SearchBar.FAMOUS_SPOTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'welcome-chip';
      const name = document.createElement('span');
      name.className = 'welcome-chip-name';
      name.textContent = spot.name;
      const region = document.createElement('span');
      region.className = 'welcome-chip-region';
      region.textContent = spot.region || '';
      b.append(name, region);
      b.addEventListener('click', () => this._onSearch(spot.lat, spot.lon, { name: spot.name }));
      chips.appendChild(b);
    }
    famous.append(famousHead, chips);

    const actions = document.createElement('div');
    actions.className = 'welcome-actions';

    const random = document.createElement('button');
    random.type = 'button';
    random.className = 'welcome-random';
    random.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-dice"/></svg><span>Random landmark</span>';
    random.addEventListener('click', () => {
      const spots = SearchBar.FAMOUS_SPOTS;
      const spot = spots[Math.floor(Math.random() * spots.length)];
      if (!spot) return;
      if (typeof this._onRandom === 'function') {
        this._onRandom(spot);
      } else {
        this._onSearch(spot.lat, spot.lon, { name: spot.name });
      }
    });

    const locate = document.createElement('button');
    locate.type = 'button';
    locate.className = 'welcome-locate';
    locate.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-locate"/></svg><span>My location</span>';
    locate.addEventListener('click', () => this._onMyLocation());

    actions.append(random, locate);

    const saved = document.createElement('section');
    saved.className = 'welcome-saved';
    const savedHead = document.createElement('h2');
    savedHead.textContent = 'Saved places';
    this._savedList = document.createElement('ul');
    this._savedList.className = 'welcome-saved-list';
    saved.append(savedHead, this._savedList);
    saved.classList.add('hidden');

    card.append(brand, search, famous, actions, saved);
    this.container.appendChild(card);
  }

  _buildSaved() {
    const list = loadPlaces();
    if (!this._savedList) return;
    this._savedList.textContent = '';

    for (const p of list) {
      const li = document.createElement('li');
      li.className = 'welcome-saved-item';

      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'welcome-saved-load';
      load.textContent = p.name;
      load.addEventListener('click', () => this._onSearch(p.lat, p.lon, { name: p.name }));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'welcome-saved-del';
      del.setAttribute('aria-label', `Delete ${p.name}`);
      del.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-close"/></svg>';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this._deletePlace(p);
      });

      li.append(load, del);
      this._savedList.appendChild(li);
    }

    const section = this.container.querySelector('.welcome-saved');
    if (section) section.classList.toggle('hidden', list.length === 0);
  }

  _deletePlace(p) {
    const list = loadPlaces().filter(
      (x) => !(x.name === p.name && x.lat === p.lat && x.lon === p.lon)
    );
    savePlaces(list);
    this._buildSaved();
  }

  dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;

    const el = this.container;
    el.classList.add('dismissing');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add('hidden');
      el.classList.remove('dismissing');
    };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 600);
  }

  show() {
    this._dismissed = false;
    const el = this.container;
    el.classList.remove('hidden', 'dismissing');
    this._buildSaved();
  }
}
