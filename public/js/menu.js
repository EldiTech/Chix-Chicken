/* The feast, from Firestore (menuItems via app.js) and live. Dishes are
 * configured in the Firebase console or scripts/seed-menu.mjs; hidden ones
 * are left out here and can't be held (firestore.rules). */
const grid = document.getElementById('dishes');
const empty = document.getElementById('menuEmpty');
let shown = null;

function dish(m) {
  const card = document.createElement('article');
  card.className = 'card dish';
  card.dataset.item = m.id;
  if (m.image) {
    const img = document.createElement('img');
    img.src = m.image;
    img.alt = m.alt || m.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    // A broken photo link falls back to the dish's initial, not a broken icon.
    img.addEventListener('error', () => img.replaceWith(placeholder(m)), { once: true });
    card.append(img);
  } else {
    card.append(placeholder(m));
  }
  const text = document.createElement('div');
  const tag = Object.assign(document.createElement('p'), { className: 'label', textContent: m.tag || '' });
  const name = Object.assign(document.createElement('h2'), { textContent: m.name });
  const blurb = Object.assign(document.createElement('p'), { textContent: m.blurb || '' });
  text.append(tag, name, blurb);
  card.append(text);
  return card;
}

function placeholder(m) {
  const ph = document.createElement('span');
  ph.className = 'dish-ph';
  ph.setAttribute('aria-hidden', 'true');
  ph.textContent = m.name.charAt(0);
  return ph;
}

function render() {
  if (!window.Unli || !Unli.store.menuLoaded()) return;
  const list = Unli.store.menu().filter(m => m.hidden !== true);
  // Only rebuild when something visible changed.
  const sig = JSON.stringify(list.map(m => [m.id, m.name, m.tag, m.blurb, m.image, m.alt]));
  if (sig === shown) return;
  shown = sig;
  grid.replaceChildren(...list.map(dish));
  grid.removeAttribute('aria-busy');
  empty.hidden = list.length > 0;
}

window.addEventListener('unli-data-changed', render);
render();
