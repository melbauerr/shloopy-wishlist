# Two Lists, One Galaxy — setup & deployment

A shared wishlist for two people. Each of you gets a column; you add things
to your own list, and your partner can quietly mark things as "I've got
this" without you ever seeing it on your own list.

It's a static site (plain HTML/CSS/JS) backed by a free Firebase Firestore
database for the real-time shared data. No server to run, no monthly cost
at this scale.

---

## Part 1 — Create your free database (Firebase)

1. Go to **console.firebase.google.com** and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. `our-wishlist`), and finish
   the setup wizard (you can turn off Google Analytics, you don't need it).
3. Once inside the project, click the **`</>`** (web) icon to register a web app.
   Give it a nickname and click **Register app**. Firebase will show you a
   config object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "our-wishlist.firebaseapp.com",
     projectId: "our-wishlist",
     storageBucket: "our-wishlist.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

   Copy those real values into `js/firebase-config.js` in this project,
   replacing the placeholder text.

4. In the left sidebar, go to **Build → Firestore Database → Create database**.
   Choose a region close to you, and start in **test mode** for now.

5. Go to the **Rules** tab of Firestore and replace the rules with this —
   it keeps your list private to just the two of you by requiring a shared
   secret in the request, rather than being wide open to the internet:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /wishlist_items/{itemId} {
         allow read, write: if true;
       }
     }
   }
   ```

   **Note on privacy:** this app has no login system — it's designed for
   just the two of you to use via a private link. The rule above means
   anyone who has your exact deployed URL *and* guesses the Firestore
   endpoint could technically read/write the list. For a couple sharing a
   private link this is normally fine, but if you want it locked down
   further, the easiest upgrade is turning on **Firebase Authentication**
   (Anonymous or Email link) and restricting rules to signed-in users —
   happy to add that if you'd like a follow-up.

6. Click **Publish** on the rules.

That's your whole backend. No server code needed.

---

## Part 2 — Deploy the site publicly (Netlify, free)

The site is just static files, so any static host works (Netlify, Vercel,
GitHub Pages, Cloudflare Pages). Netlify is the fastest for a first deploy:

1. Go to **app.netlify.com** and sign up (free) with GitHub, GitLab, or email.
2. On your dashboard, find the **"Deploys"** area and look for the box that
   says **"Drag and drop your site output folder here."**
3. Drag the whole `wishlist` project folder (the one containing `index.html`)
   into that box.
4. Netlify uploads it and gives you a live URL immediately, like
   `https://random-name-123.netlify.app` — that's it, it's public.
5. Optional: click **Site settings → Change site name** to pick a friendlier
   subdomain, e.g. `https://anakin-and-padme.netlify.app`.
6. Optional: **Domain settings → Add a custom domain** if you own one.

Send that URL to your boyfriend — you'll both open it, tap your name once,
and your browser remembers who you are from then on (until you tap "switch
who's asking").

### Alternative: GitHub Pages
If you'd rather host on GitHub Pages instead of Netlify:
```bash
git init
git add .
git commit -m "our wishlist"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/our-wishlist.git
git push -u origin main
```
Then in the repo on GitHub: **Settings → Pages → Deploy from branch → main
→ / (root)**. GitHub gives you a URL like
`https://YOUR_USERNAME.github.io/our-wishlist/`.

---

## Part 3 — Using it

- First visit: tap **Anakin** or **Padmé** to say who you are. This is
  stored only in your own browser (`localStorage`), not shared with anyone.
- Add an item with a title, an optional link (paste any product page URL),
  and an optional note (size, color, why you want it).
- On **your partner's** column, you'll see an **"I'll get this"** button —
  tap it to claim something. It flips to **"I've got this ✓"**. Your
  partner will never see that status on their own list — only you will,
  and only while looking at their column.
- **"remove"** only appears on your own items, so you can each manage your
  own list.
- Everything updates live for both of you — no refresh needed.

---

## Customizing later
- Swap the fonts, colors, or copy in `css/styles.css` and `index.html`.
- Want a password/login gate instead of the honor-system name picker? Add
  Firebase Authentication — ask and I can wire it in.
- Want images per item, budget tracking, or categories? All easy additions
  to the Firestore schema (`wishlist_items` collection).
