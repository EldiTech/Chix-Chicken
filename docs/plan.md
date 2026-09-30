# My Account Page Plan

## Goal

Make the customer account page show real Firestore data.

No demo plans.
No browser storage.

Customer sees only own plans, holds, orders, and profile.

## Page Flow

1. User signs in with Firebase Auth.
2. App reads `users/{uid}` from Firestore.
3. Page shows user name and sign-in email.
4. App listens for that user's tickets.
5. Cards update when a booking, hold, or order changes.
6. User saves display name to Firestore.

## My Plans Card

Shows next active reservation only.

- Source: `tickets` where `ownerUid == current uid` and `type == "reserve"`.
- Sort: nearest booking date first.
- Card text: party size, branch, date, time, status.
- Empty state: `No plans yet. Book a table to get started.`
- Link: opens Branches page or reservation details.

## Your Meals Card

Shows active and recent orders.

- Source: `tickets` where `ownerUid == current uid` and `type == "order"`.
- Sort: newest first.
- Show: ticket number, ordered items, status, created time.
- Empty state: `No orders yet.`
- Link: opens Feast page.

## Hold an Item

Button opens the existing hold modal.

1. Customer picks limited item, quantity, and pickup time.
2. App validates branch hours and pickup time.
3. App writes one `tickets/{ticketId}` document.
4. Document has `type: "hold"`, `status: "held"`, and `ownerUid`.
5. Page listener adds the hold to My Plans or a future Holds list.
6. Staff changes status to `collected` after pickup.

## Account Details

Display name can change.

- Read: `users/{uid}.name`
- Write: `users/{uid}.name` and `updatedAt`
- Email is read-only. Firebase Auth owns it.
- Role is read-only. Only admin tools may change it.
- Save button shows saving, success, and failure state.

## Firestore Data

### `users/{uid}`

```js
{
  email: "customer@example.com",
  name: "Customer Name",
  role: "customer",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

### `tickets/{ticketId}`

```js
{
  no: "ABC123",
  ownerUid: "firebase-user-id",
  type: "order" | "hold" | "reserve",
  status: "raw" | "cooking" | "plated" | "served" | "held" | "collected" | "reserved",
  branch: "Rodriguez",
  party: 4,
  items: ["Ramen × 2"],
  customer: { name: "Customer Name", email: "customer@example.com" },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

## Security Rules

- Signed-in customer reads own user document.
- Signed-in customer updates own name only.
- Signed-in customer reads own tickets only.
- Signed-in customer creates tickets only with own `ownerUid`.
- Staff reads tickets and updates ticket status.
- Manager changes menu visibility and reads audit logs.
- Anyone reads `branches`. Only a manager adds or edits one; never deleted, only paused (`active: false`).
- Holds and reserves only at an active branch; customer table slot within that branch's `open`–`lastSeating`.

### `branches/{id}`

`id` is what tickets store in `branch` (e.g. `Rodriguez`). First seed: `scripts/seed-branches.mjs`.

```js
{
  name: "Rodriguez",
  address: "J.P. Rizal Street, Rodriguez, Rizal",
  phone: "",
  open: "10:00", lastSeating: "20:30", close: "22:00",
  active: true,
  sort: 10,
  updatedAt: serverTimestamp()
}
```

## Live Updates

Use Firestore `onSnapshot` listeners.

- Reservation changed by staff: customer page updates.
- Hold collected: status updates.
- New order: meal card updates.
- No refresh needed.

## Build Order

1. Replace fixed `Table for 4` with live reservation card.
2. Replace fixed meal text with live order card.
3. Add loading skeletons and empty states.
4. Add reservation cancellation rules and UI.
5. Add ticket detail page.
6. Test customer, staff, manager, signed-out user, and failed Firestore write.

## Done Check

- No account data comes from local storage.
- Refresh keeps data from Firestore.
- One user cannot read another user's tickets.
- Empty cards show clear next action.
- Profile name save survives refresh.
