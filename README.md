# Two Lists, One Galaxy — setup & deployment

Two shared wishlists (fully visible to both of you — add to either one, see
who added what) plus one **private secret stash per person**, for surprises
or "already bought this" notes, locked to your Firebase account so your
partner can never see it — not just hidden in the UI, but blocked by
Firestore's own security rules.

---

## 1. Git workflow

You're making these changes on a working branch, then merging once it's
tested:

```bash
git checkout -b feature/shared-lists-secret-stash
# ...copy these files in, test locally (see section 3)...
git add .
git commit -m "Shared visibility on both lists, private secret stash, Star Wars polish"
git push -u origin feature/shared-lists-secret-stash
```

Once you've confirmed it works (section 3), open a PR on GitHub from
`feature/shared-lists-secret-stash` into `main` and merge it — or, since
it's just the two of you, merge straight from the terminal:

```bash
git checkout main
git merge feature/shared-lists-secret-stash
git push origin main
```

---

## 2. Firebase — Firestore rules

Paste `firestore.rules` (included in this project) into **Firestore
Database → Rules** in the Firebase console, then **Publish**. It restricts
both collections to exactly your two account UIDs — the same approach your
original rule used, extended to cover the new `secret_items` collection.

The first time the secret stash loads, Firestore may prompt you in the
browser console to create a composite index (it filters by `ownerUid` and
sorts by `createdAt`). Click the link it gives you, hit **Create index**,
wait about a minute, then reload.

---

## 3. Run and test it locally

Module imports don't work over `file://`, so serve it:

```bash
cd wishlist
python3 -m http.server 8000
```
Open **http://localhost:8000**. Test with two windows (one normal, one
incognito), signed in as each account, and confirm:
- an item added to a shared list appears in both windows within a second or two
- a secret stash item never appears in the other window
- removing an item updates both windows live

---

## 4. Deploy for real (Netlify + GitHub, continuous deployment)

Since your code now lives on GitHub, connect Netlify directly to the repo
instead of drag-and-drop — every push to `main` deploys automatically from
here on:

1. **app.netlify.com** → **Add new site → Import an existing project →
   Deploy with GitHub**.
2. Authorize Netlify for your GitHub account, then pick
   **melbauerr/shloopy-wishlist**.
3. Build settings: leave **Build command** blank and **Publish directory**
   as `.` (or `/` — this is a static site, nothing to build).
4. Click **Deploy site**. Netlify gives you a live URL immediately.
5. **Site settings → Change site name** — a good match for your repo name:
   **`shloopy-wishlist.netlify.app`**. If that's taken, try
   `shloopy-wishlist-hq.netlify.app` or `twolists-onegalaxy.netlify.app`.
6. From now on, `git push origin main` redeploys automatically — no manual
   drag-and-drop needed again.

Send the resulting URL to your boyfriend — you'll each sign in once and
stay signed in after that.

---

## Does the data last forever?

Yes — Firestore on the free Spark plan has no data expiry; it's kept until
you delete it. Free daily quotas (50K reads / 20K writes / 20K deletes,
1GiB stored) are far beyond normal use by two people. The only real risk
is a completely untouched Firebase project being flagged inactive after a
long stretch of zero use — opening the site now and then avoids that.

---

## Customizing further

Everything person-specific — names, subtitles, emails, uids — lives in the
`PEOPLE` object at the top of `js/app.js`. Colors and fonts live in the
`:root` block at the top of `css/styles.css`.
