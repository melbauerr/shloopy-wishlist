import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ============================================================
// PEOPLE — the only block you should need to touch. uid must
// match Firebase Authentication > Users, and must also appear
// in firestore.rules for both collections.
// ============================================================
const PEOPLE = {
  anakin: {
    label: "Anakin",
    sub: "Tatooine · twin suns",
    email: "johnny.zammit03@gmail.com",
    uid: "YiseNexpFLP8GP4OLQYDb7KV4Li2"
  },
  padme: {
    label: "Padmé",
    sub: "Naboo · lake country",
    email: "mel.bauerr@gmail.com",
    uid: "lUlrBxUSMtg2M4oIscxeybT8wOJ2"
  }
};

// ============================================================
// Firebase setup
// ============================================================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const itemsCol = collection(db, "wishlist_items");
const secretsCol = collection(db, "secret_items");

// ============================================================
// Page elements
// ============================================================
const gateEl = document.getElementById("gate");
const appEl = document.getElementById("app");
const gateNote = document.getElementById("gateNote");
const viewerEyebrow = document.getElementById("viewerEyebrow");
const switchBtn = document.getElementById("switchBtn");
const itemOwnerSelect = document.getElementById("itemOwner");
const itemTitle = document.getElementById("itemTitle");
const itemUrl = document.getElementById("itemUrl");
const itemNote = document.getElementById("itemNote");
const addItemBtn = document.getElementById("addItemBtn");
const secretTitle = document.getElementById("secretTitle");
const secretUrl = document.getElementById("secretUrl");
const secretNote = document.getElementById("secretNote");
const addSecretBtn = document.getElementById("addSecretBtn");
const secretList = document.getElementById("secretItemsList");
const secretEmpty = document.getElementById("secretEmptyState");

let viewerKey = null;
let sharedItems = [];
let secretItems = [];
let unsubscribeSecret = null;

// ============================================================
// Login
// ============================================================
async function loginAs(personKey) {
  const email = PEOPLE[personKey]?.email;
  if (!email) { gateNote.textContent = "No email configured for that person."; return; }
  const password = prompt(`Password for ${PEOPLE[personKey].label}:`);
  if (!password) return;

  gateNote.textContent = "Signing in...";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Login error:", err);
    gateNote.textContent = "Login failed. Check the password.";
  }
}

document.querySelectorAll(".who-btn").forEach((btn) => {
  btn.addEventListener("click", () => loginAs(btn.dataset.who));
});

switchBtn.addEventListener("click", async () => {
  try { await signOut(auth); } catch (err) { console.error("Sign out error:", err); }
});

// ============================================================
// Auth state
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (unsubscribeSecret) { unsubscribeSecret(); unsubscribeSecret = null; }

  if (!user) {
    viewerKey = null;
    gateEl.classList.remove("hidden");
    appEl.classList.add("hidden");
    return;
  }

  viewerKey = Object.keys(PEOPLE).find((k) => PEOPLE[k].uid === user.uid) || null;
  if (!viewerKey) {
    console.error("Signed-in uid doesn't match any PEOPLE entry:", user.uid);
    gateNote.textContent = "That account isn't set up in app.js.";
    signOut(auth);
    return;
  }

  gateEl.classList.add("hidden");
  appEl.classList.remove("hidden");
  viewerEyebrow.textContent = `viewing as ${PEOPLE[viewerKey].label}`;
  itemOwnerSelect.value = viewerKey;

  listenToSecrets(user.uid);
  renderShared();
});

// ============================================================
// Shared items — visible & editable by both signed-in people
// ============================================================
const sharedQuery = query(itemsCol, orderBy("createdAt", "desc"));
onSnapshot(
  sharedQuery,
  (snapshot) => {
    sharedItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderShared();
  },
  (err) => {
    console.error("Firestore error (shared):", err);
    gateNote.textContent = "Couldn't load the shared lists — check Firestore rules.";
  }
);

addItemBtn.addEventListener("click", async () => {
  if (!viewerKey) return;
  const title = itemTitle.value.trim();
  if (!title) { itemTitle.focus(); return; }
  let url = itemUrl.value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

  addItemBtn.disabled = true;
  try {
    await addDoc(itemsCol, {
      owner: itemOwnerSelect.value,
      addedBy: viewerKey,
      title,
      url: url || null,
      note: itemNote.value.trim() || null,
      createdAt: serverTimestamp()
    });
    itemTitle.value = ""; itemUrl.value = ""; itemNote.value = "";
    itemOwnerSelect.value = viewerKey;
    itemTitle.focus();
  } catch (err) {
    console.error("Add item error:", err);
    alert("Couldn't add that item — check your Firebase setup.");
  } finally {
    addItemBtn.disabled = false;
  }
});

[itemTitle, itemUrl, itemNote].forEach((input) =>
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") addItemBtn.click(); })
);

async function deleteSharedItem(itemId) {
  if (!confirm("Remove this item from the list?")) return;
  try { await deleteDoc(doc(db, "wishlist_items", itemId)); }
  catch (err) { console.error("Delete error:", err); alert("Couldn't remove that item."); }
}

function renderShared() {
  if (!viewerKey) return;
  Object.keys(PEOPLE).forEach((ownerKey) => {
    const listEl = document.querySelector(`.items[data-list-for="${ownerKey}"]`);
    const emptyEl = document.querySelector(`.empty-state[data-empty-for="${ownerKey}"]`);
    if (!listEl) return;
    const items = sharedItems.filter((i) => i.owner === ownerKey);
    listEl.innerHTML = items.map(sharedItemHTML).join("");
    if (emptyEl) emptyEl.style.display = items.length ? "none" : "block";
  });

  document.querySelectorAll('[data-action="delete-shared"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteSharedItem(btn.dataset.id));
  });
}

function sharedItemHTML(item) {
  const linkTitle = item.url
    ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.title)}</a>`
    : escapeHTML(item.title);
  const addedByLabel = PEOPLE[item.addedBy]?.label || item.addedBy;

  return `
    <li class="item">
      <p class="item-title">${linkTitle}</p>
      ${item.note ? `<p class="item-note">${escapeHTML(item.note)}</p>` : ""}
      <div class="item-foot">
        <span class="added-by">added by ${escapeHTML(addedByLabel)}</span>
        <button class="delete-btn" data-action="delete-shared" data-id="${item.id}">remove</button>
      </div>
    </li>
  `;
}

// ============================================================
// Secret stash — private per signed-in user. Firestore rules
// enforce this server-side (see firestore.rules).
// ============================================================
function listenToSecrets(uid) {
  const secretQuery = query(secretsCol, where("ownerUid", "==", uid), orderBy("createdAt", "desc"));
  unsubscribeSecret = onSnapshot(
    secretQuery,
    (snapshot) => {
      secretItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderSecrets();
    },
    (err) => console.error("Firestore error (secret):", err)
  );
}

addSecretBtn.addEventListener("click", async () => {
  if (!viewerKey || !auth.currentUser) return;
  const title = secretTitle.value.trim();
  if (!title) { secretTitle.focus(); return; }
  let url = secretUrl.value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

  addSecretBtn.disabled = true;
  try {
    await addDoc(secretsCol, {
      ownerUid: auth.currentUser.uid,
      title,
      url: url || null,
      note: secretNote.value.trim() || null,
      createdAt: serverTimestamp()
    });
    secretTitle.value = ""; secretUrl.value = ""; secretNote.value = "";
    secretTitle.focus();
  } catch (err) {
    console.error("Add secret error:", err);
    alert("Couldn't add that — check Firestore rules for secret_items.");
  } finally {
    addSecretBtn.disabled = false;
  }
});

[secretTitle, secretUrl, secretNote].forEach((input) =>
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") addSecretBtn.click(); })
);

async function deleteSecretItem(itemId) {
  if (!confirm("Remove this from your secret stash?")) return;
  try { await deleteDoc(doc(db, "secret_items", itemId)); }
  catch (err) { console.error("Delete secret error:", err); }
}

function renderSecrets() {
  secretList.innerHTML = secretItems.map(secretItemHTML).join("");
  secretEmpty.style.display = secretItems.length ? "none" : "block";
  document.querySelectorAll('[data-action="delete-secret"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteSecretItem(btn.dataset.id));
  });
}

function secretItemHTML(item) {
  const linkTitle = item.url
    ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.title)}</a>`
    : escapeHTML(item.title);
  return `
    <li class="item">
      <p class="item-title">${linkTitle}</p>
      ${item.note ? `<p class="item-note">${escapeHTML(item.note)}</p>` : ""}
      <div class="item-foot">
        <span></span>
        <button class="delete-btn" data-action="delete-secret" data-id="${item.id}">remove</button>
      </div>
    </li>
  `;
}

// ============================================================
// Helpers
// ============================================================
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHTML(str); }
