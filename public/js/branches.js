/* Branches page, from Firestore (branches/{id}) — managers configure them on
 * the dashboard. Paused branches still show, without the booking button. */
import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const list = document.getElementById('branchList');
const soon = document.getElementById('comingSoon');

const fmt = v => { const [h, m] = v.split(':').map(Number); return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? ' AM' : ' PM'); };
const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? { className } : {}, text !== undefined ? { textContent: text } : {});

function card(b, i) {
  const art = el('article', 'card branch');
  const text = el('div');
  const status = el('p', 'open', b.active ? 'OPEN TODAY · ' + fmt(b.open) + '–' + fmt(b.close) : 'NOT TAKING BOOKINGS RIGHT NOW');
  if (!b.active) status.style.color = 'var(--muted)';
  text.append(status, el('h2', '', b.name), el('p', '', b.address));
  if (b.phone) {
    const p = el('p');
    p.append(Object.assign(el('a', '', b.phone), { href: 'tel:' + b.phone.replace(/[^0-9+]/g, '') }));
    text.append(p);
  }
  const action = b.active
    ? Object.assign(el('a', 'btn-primary', 'Plan a visit'), { href: 'accounts/user/book.html?branch=' + encodeURIComponent(b.id.toLowerCase()) })
    : Object.assign(el('a', 'btn-ghost', 'View feast'), { href: 'menu.html' });
  art.append(el('span', 'branch-no', String(i + 1).padStart(2, '0')), text, action);
  return art;
}

try {
  const snap = await getDocs(collection(db, 'branches'));
  const branches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(b => typeof b.name === 'string' && b.name && [b.open, b.lastSeating, b.close].every(t => typeof t === 'string'))
    .sort((a, b) => (b.active === true) - (a.active === true) || (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name));
  soon.before(...branches.map(card));
} catch (err) {
  console.warn('Could not load branches:', err.code || err);
  soon.before(el('p', 'notice', 'Couldn’t load our branches. Refresh to try again.'));
}
list.removeAttribute('aria-busy');
