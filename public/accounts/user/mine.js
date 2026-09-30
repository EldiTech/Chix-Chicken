/* The signed-in customer's own tickets, live from Firestore (docs/plan.md "Live Updates").
 * Two listeners, merged by id:
 *   - ownerUid == me          → holds and orders the customer placed
 *   - customer.email == me    → reserves and holds staff booked for them
 * firestore.rules allows exactly these two reads for a customer, nothing wider. */
import { auth, db } from '../../js/firebase.js';
import { collection, getDocs, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const STATUS = {
  raw: 'Order received', cooking: 'Cooking', plated: 'Plated', served: 'Served',
  held: 'Held for pickup', collected: 'Picked up',
  reserved: 'Reserved', seated: 'Seated', cancelled: 'Cancelled',
};
export const TYPE = { order: 'Dine-in order', hold: 'Pickup hold', reserve: 'Table reservation' };

// Branches, as managers configure them on the dashboard (branches/{id}).
// `id` is what tickets store in `branch`. Call loadBranches() before use.
export const BRANCHES = [];
let loading = null;
export function loadBranches() {
  loading = loading || getDocs(collection(db, 'branches')).then(snap => {
    BRANCHES.splice(0, BRANCHES.length, ...snap.docs
      .map(d => ({ id: d.id, key: d.id.toLowerCase(), ...d.data() }))
      .filter(b => typeof b.name === 'string' && b.name && [b.open, b.lastSeating, b.close].every(t => typeof t === 'string'))
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name)));
    return BRANCHES;
  }).catch(err => {
    console.warn('Could not load branches:', err.code || err);
    return BRANCHES;
  });
  return loading;
}
// Paused or unknown branches still name themselves on old tickets.
export const branchOf = t => BRANCHES.find(b => b.id === t.branch) || { id: t.branch, name: t.branch || 'Unli Chix', address: '' };

// A calendar file for a reservation (2-hour visit). Opens in any calendar app.
export function downloadIcs(t) {
  const start = t.at && t.at.toDate ? t.at.toDate() : new Date(t.date + 'T' + t.slot + ':00');
  const end = new Date(start.getTime() + 2 * 3600000);
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const b = branchOf(t);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unli Chix//Reservations//EN', 'BEGIN:VEVENT',
    'UID:' + t.id + '@unli-chix', 'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(start), 'DTEND:' + stamp(end),
    'SUMMARY:' + esc('Unli Chix — table for ' + t.party),
    'LOCATION:' + esc(['Unli Chix ' + b.name, b.address].filter(Boolean).join(', ')),
    'DESCRIPTION:' + esc('Reservation #' + t.no + '. Show this number when you arrive.'),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'unli-chix-' + t.no + '.ics';
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const millis = t => (t.createdAt && t.createdAt.toMillis ? t.createdAt.toMillis() : Date.now());

export function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
export function fmtSlot(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
}
export function fmtCreated(t) {
  return new Date(millis(t)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// When a reserve is for. Older reserves only carry the display text in `where`.
export function whenOf(t) {
  if (t.date && t.slot) return fmtDay(t.date) + ', ' + fmtSlot(t.slot);
  return t.where || '';
}

// A reserve still ahead of us. Undated legacy reserves count until cancelled.
export function upcoming(t, today = isoDate(new Date())) {
  return t.type === 'reserve' && t.status === 'reserved' && (!t.date || t.date >= today);
}

// Nearest booking first; undated legacy reserves after dated ones.
export const byBooking = (a, b) =>
  (a.date || '9999').localeCompare(b.date || '9999') || (a.slot || '').localeCompare(b.slot || '') || millis(a) - millis(b);
export const newestFirst = (a, b) => millis(b) - millis(a);

export function watchMine(onChange, onError) {
  const user = auth.currentUser;
  const mine = new Map();   // ownerUid matches
  const forMe = new Map();  // customer.email matches
  let answered = 0;
  const emit = () => {
    if (answered < 2) return; // wait for both, so cards don't flash "empty" first
    onChange([...new Map([...forMe, ...mine]).values()]);
  };
  const listen = (q, into) => {
    let first = true;
    return onSnapshot(q, snap => {
      into.clear();
      snap.docs.forEach(d => into.set(d.id, { id: d.id, ...d.data() }));
      if (first) { first = false; answered += 1; }
      emit();
    }, err => {
      console.warn('Could not load your tickets:', err.code || err);
      onError(err);
    });
  };
  const tickets = collection(db, 'tickets');
  const stops = [listen(query(tickets, where('ownerUid', '==', user.uid)), mine)];
  if (user.email) stops.push(listen(query(tickets, where('customer.email', '==', user.email)), forMe));
  else answered += 1;
  return () => stops.forEach(stop => stop());
}
