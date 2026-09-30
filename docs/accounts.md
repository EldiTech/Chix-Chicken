# Accounts

Account pages live in `public/accounts/`, one folder per account type.

- `guest/` — anonymous visitor. Can browse the menu and branches.
- `user/` — signed-in customer. Live plans, meals, holds, and profile from Firestore; `ticket.html?id=…` shows one ticket and lets the customer cancel an upcoming reservation.

Sign-in uses Firebase Authentication (`public/js/firebase.js`). Each user's role is stored in Firestore at `users/{uid}` and enforced by `firestore.rules`; new sign-ups are always customers. To make someone staff or a manager, change the `role` field on their `users/{uid}` document in the Firebase console.

Pages marked `<body data-protected>` send signed-out visitors to the sign-in page. Tickets, the menu, and the audit log live in Firestore (`public/js/app.js`); `firestore.rules` decides who can read or change each one.

## Menu

Dishes live in `menuItems/{id}` with `name`, `tag`, `blurb`, `image`, `alt`, `sort`, `limited` (can be held for pickup), and `hidden`.

On the dashboard, **Menu** lets staff and managers add dishes and edit name, tag, description, photo, order, and limited. Only managers hide, show, or remove a dish. Every change goes to the audit log.

To load a whole menu at once, edit `scripts/data/menu.json` and run:

```sh
cd scripts && npm install
node seed-menu.mjs   # add --dry-run to preview, --overwrite to reset fields
```

Re-running only fills in missing dishes and fields, so console edits are kept.

## Rule tests

Needs Java 21+.

```sh
firebase emulators:exec --only firestore --project demo-unli "cd scripts && npm run test:rules"
```

## Trying the site locally

`firebase emulators:start`, seed with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-menu.mjs`, then open `http://127.0.0.1:5000/login.html?emulator`. The `?emulator` switch only works on localhost and sticks for that tab.
