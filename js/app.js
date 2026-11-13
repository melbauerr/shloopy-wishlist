import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ============================================================
// PEOPLE — the only block you should normally need to touch.
// uid must match Firebase Authentication > Users, and must also
// appear in firestore.rules for both collections.
// ============================================================
const PEOPLE = {
  anakin: { label: "Anakin", email: "johnny.zammit03@gmail.com", uid: "YiseNexpFLP8GP4OLQYDb7KV4Li2" },
  padme: { label: "Padmé", email: "mel.bauerr@gmail.com", uid: "lUlrBxUSMtg2M4oIscxeybT8wOJ2" }
};

const DROID_LINES = [
  "Do or do not add to cart. There is no try. - Yoda",
  "Roger, roger. - some B1-Battle droid",
  "Don't shoot! I'm not the commander, he's the commander! - some B1-Battle droid",
  "To the dark side, empty wallets lead. Spend wisely on this list, you must. - Yoda",
  "There's 3 of us and only 1 of him. - some B1-Battle droid",
  "Boy, this is a lot more fun when they're not shooting back. - some B1-Battle droid",
  "R2-D2, you know better than to trust a strange computer. - C3PO",
  "I suggest a new strategy, R2: Let the Wookiee win. - C3PO",
  "Good soldiers follow orders.",
  "Execute Order 66.",
  "Many gifts, this list holds. Buy them for me, you will.",
  "Wipe them out. All of them!",
  "Even the children!!!",
  "Power! Unlimited power!",
  "No longer certain that one ever does win a war, I am.",
  "It takes strength to resist the dark side. Only the weak embrace it.",
  "Aaaaaaaaaaaaaaaarrrgh! - Chewie",
  "Are you an angel?",
  "Doo-doo-di-doo - some mouse droid",
  "Choose wisely, you must.",
  "Dew it - Palpatine",
  "Patience you must have, my young Padawan."
];

// ============================================================
// Firebase setup
// ============================================================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const itemsCol = collection(db, "wishlist_items");
const secretsCol = collection(db, "secret_items");

// ============================================================
// Elements
// ============================================================
const gateEl = document.getElementById("gate");
const appEl = document.getElementById("app");
const gateNote = document.getElementById("gateNote");
const gateChoices = document.getElementById("gateChoices");
const loginForm = document.getElementById("loginForm");
const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const loginBack = document.getElementById("loginBack");

const sessionEl = document.getElementById("session");
const viewerName = document.getElementById("viewerName");
const signOutBtn = document.getElementById("signOutBtn");
const sideToggle = document.getElementById("sideToggle");
const toggleBlade = document.getElementById("toggleBlade");

const tabsEl = document.getElementById("tabs");
const boardEl = document.getElementById("board");

const secretFab = document.getElementById("secretFab");
const secretCount = document.getElementById("secretCount");
const scrim = document.getElementById("scrim");
const secretDrawer = document.getElementById("secretDrawer");
const drawerClose = document.getElementById("drawerClose");
const secretForm = document.getElementById("secretForm");
const secretInput = document.getElementById("secretInput");
const secretList = document.getElementById("secretItemsList");
const secretEmpty = document.getElementById("secretEmpty");

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editTitle = document.getElementById("editTitle");
const editUrl = document.getElementById("editUrl");
const editPrice = document.getElementById("editPrice");
const editNote = document.getElementById("editNote");
const editDelete = document.getElementById("editDelete");
const editCancel = document.getElementById("editCancel");

const droidBtn = document.getElementById("droid");
const toastEl = document.getElementById("toast");

let viewerKey = null;
let pendingLoginKey = null;
let sharedItems = [];
let secretItems = [];
let unsubscribeSecret = null;
let editingContext = null; // { kind: "shared"|"secret", id }

// ============================================================
// Toast
// ============================================================
let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ============================================================
// Light side / dark side toggle
// ============================================================
function applySide(side) {
  document.documentElement.setAttribute("data-side", side);
  localStorage.setItem("side", side);
}
applySide(localStorage.getItem("side") || "light");

sideToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-side") === "dark" ? "light" : "dark";
  applySide(next);
  toggleBlade.animate(
    [{ transform: "scaleY(0.2)", opacity: 0.4 }, { transform: "scaleY(1)", opacity: 1 }],
    { duration: 260, easing: "ease-out" }
  );
});

// ============================================================
// Gate — pick person, then password
// ============================================================
gateChoices.querySelectorAll(".who-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingLoginKey = btn.dataset.who;
    loginName.textContent = PEOPLE[pendingLoginKey].label;
    gateChoices.classList.add("hidden");
    loginForm.classList.remove("hidden");
    loginPassword.value = "";
    loginPassword.focus();
    gateNote.textContent = "";
  });
});

loginBack.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  gateChoices.classList.remove("hidden");
  pendingLoginKey = null;
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingLoginKey) return;
  const email = PEOPLE[pendingLoginKey].email;
  const password = loginPassword.value;
  if (!password) return;

  gateNote.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Login error:", err);
    gateNote.textContent = "That password didn't work.";
  }
});

signOutBtn.addEventListener("click", async () => {
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
    sessionEl.classList.add("hidden");
    secretFab.classList.add("hidden");
    loginForm.classList.add("hidden");
    gateChoices.classList.remove("hidden");
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
  sessionEl.classList.remove("hidden");
  secretFab.classList.remove("hidden");
  viewerName.textContent = PEOPLE[viewerKey].label;
  setActiveTab(viewerKey);

  listenToSecrets(user.uid);
  renderShared();
});

// ============================================================
// Mobile tabs
// ============================================================
function buildTabs() {
  tabsEl.innerHTML = Object.keys(PEOPLE)
    .map((key) => `<button class="tab" data-tab="${key}">${PEOPLE[key].label}</button>`)
    .join("");
  tabsEl.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}
function setActiveTab(key) {
  boardEl.dataset.tab = key;
  tabsEl.querySelectorAll(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === key));
}
buildTabs();

// ============================================================
// Smart quick-add parsing: pulls a URL and a $price out of one
// line of free text, leaving the rest as the title.
// ============================================================
function parseQuickAdd(raw) {
  let text = raw.trim();
  let url = null;
  let price = null;

  const urlMatch = text.match(/https?:\/\/\S+/i);
  if (urlMatch) {
    url = urlMatch[0];
    text = (text.slice(0, urlMatch.index) + text.slice(urlMatch.index + urlMatch[0].length)).trim();
  }

  const priceMatch = text.match(/\$\s?\d+(\.\d{1,2})?/);
  if (priceMatch) {
    price = priceMatch[0].replace(/\s/g, "");
    text = (text.slice(0, priceMatch.index) + text.slice(priceMatch.index + priceMatch[0].length)).trim();
  }

  text = text.replace(/\s{2,}/g, " ").replace(/^[-–—,\s]+|[-–—,\s]+$/g, "").trim();
  return { title: text, url, price };
}

// ============================================================
// Shared items
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
    toast("Couldn't load the shared lists.");
  }
);

document.querySelectorAll(".quickadd[data-owner]").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!viewerKey) return;
    const input = form.querySelector("input");
    const parsed = parseQuickAdd(input.value);
    if (!parsed.title && !parsed.url) { input.focus(); return; }

    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      await addDoc(itemsCol, {
        owner: form.dataset.owner,
        addedBy: viewerKey,
        title: parsed.title || parsed.url,
        url: parsed.url,
        price: parsed.price,
        note: null,
        createdAt: serverTimestamp()
      });
      input.value = "";
      input.focus();
    } catch (err) {
      console.error("Add item error:", err);
      toast("Couldn't add that — check Firebase setup.");
    } finally {
      btn.disabled = false;
    }
  });
});

function renderShared() {
  if (!viewerKey) return;
  Object.keys(PEOPLE).forEach((ownerKey) => {
    const listEl = document.querySelector(`.items[data-list-for="${ownerKey}"]`);
    const emptyEl = document.querySelector(`.empty[data-empty-for="${ownerKey}"]`);
    const countEl = document.querySelector(`.count[data-count-for="${ownerKey}"]`);
    if (!listEl) return;
    const items = sharedItems.filter((i) => i.owner === ownerKey);
    listEl.innerHTML = items.map((item) => sharedItemHTML(item)).join("");
    if (emptyEl) emptyEl.style.display = items.length ? "none" : "block";
    if (countEl) countEl.textContent = String(items.length);
  });

  document.querySelectorAll('.items .item[data-kind="shared"]').forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest(".item-link")) return;
      openEdit("shared", li.dataset.id);
    });
  });
}

function sharedItemHTML(item) {
  const addedByLabel = PEOPLE[item.addedBy]?.label || item.addedBy;
  return `
    <li class="item" data-kind="shared" data-id="${item.id}">
      <div class="item-main">
        <p class="item-title">${escapeHTML(item.title)}</p>
        <p class="item-meta">added by ${escapeHTML(addedByLabel)}${item.note ? " · " + escapeHTML(item.note) : ""}</p>
      </div>
      ${item.price ? `<span class="item-price">${escapeHTML(item.price)}</span>` : ""}
      ${item.url ? `<a class="item-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer" title="Open link" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></a>` : ""}
    </li>
  `;
}

async function deleteShared(itemId) {
  try { await deleteDoc(doc(db, "wishlist_items", itemId)); toast("Removed."); }
  catch (err) { console.error("Delete error:", err); toast("Couldn't remove that item."); }
}
async function updateShared(itemId, data) {
  try { await updateDoc(doc(db, "wishlist_items", itemId), data); toast("Saved."); }
  catch (err) { console.error("Update error:", err); toast("Couldn't save that change."); }
}

// ============================================================
// Secret stash — private per signed-in user, enforced by
// Firestore rules keyed to the real Firebase uid.
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

secretForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!viewerKey || !auth.currentUser) return;
  const parsed = parseQuickAdd(secretInput.value);
  if (!parsed.title && !parsed.url) { secretInput.focus(); return; }

  try {
    await addDoc(secretsCol, {
      ownerUid: auth.currentUser.uid,
      title: parsed.title || parsed.url,
      url: parsed.url,
      price: parsed.price,
      note: null,
      createdAt: serverTimestamp()
    });
    secretInput.value = "";
    secretInput.focus();
  } catch (err) {
    console.error("Add secret error:", err);
    toast("Couldn't add that — check Firestore rules for secret_items.");
  }
});

function renderSecrets() {
  secretList.innerHTML = secretItems.map((item) => secretItemHTML(item)).join("");
  secretEmpty.style.display = secretItems.length ? "none" : "block";
  secretCount.textContent = String(secretItems.length);
  secretCount.classList.toggle("hidden", secretItems.length === 0);

  document.querySelectorAll('.items .item[data-kind="secret"]').forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest(".item-link")) return;
      openEdit("secret", li.dataset.id);
    });
  });
}

function secretItemHTML(item) {
  return `
    <li class="item" data-kind="secret" data-id="${item.id}">
      <div class="item-main">
        <p class="item-title">${escapeHTML(item.title)}</p>
        ${item.note ? `<p class="item-meta">${escapeHTML(item.note)}</p>` : ""}
      </div>
      ${item.price ? `<span class="item-price">${escapeHTML(item.price)}</span>` : ""}
      ${item.url ? `<a class="item-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer" title="Open link" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></a>` : ""}
    </li>
  `;
}

async function deleteSecret(itemId) {
  try { await deleteDoc(doc(db, "secret_items", itemId)); toast("Removed."); }
  catch (err) { console.error("Delete secret error:", err); toast("Couldn't remove that."); }
}
async function updateSecret(itemId, data) {
  try { await updateDoc(doc(db, "secret_items", itemId), data); toast("Saved."); }
  catch (err) { console.error("Update secret error:", err); toast("Couldn't save that change."); }
}

// Drawer open/close
function openDrawer() { secretDrawer.classList.add("open"); scrim.classList.add("open"); }
function closeDrawer() { secretDrawer.classList.remove("open"); scrim.classList.remove("open"); }
secretFab.addEventListener("click", openDrawer);
drawerClose.addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);

// ============================================================
// Edit dialog — shared by both shared & secret items
// ============================================================
function openEdit(kind, id) {
  const source = kind === "shared" ? sharedItems : secretItems;
  const item = source.find((i) => i.id === id);
  if (!item) return;
  editingContext = { kind, id };
  editTitle.value = item.title || "";
  editUrl.value = item.url || "";
  editPrice.value = item.price || "";
  editNote.value = item.note || "";
  editDialog.showModal();
  editTitle.focus();
}
editCancel.addEventListener("click", () => editDialog.close());

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingContext) return;
  const data = {
    title: editTitle.value.trim(),
    url: editUrl.value.trim() || null,
    price: editPrice.value.trim() || null,
    note: editNote.value.trim() || null
  };
  if (!data.title) { editTitle.focus(); return; }

  if (editingContext.kind === "shared") await updateShared(editingContext.id, data);
  else await updateSecret(editingContext.id, data);
  editDialog.close();
  editingContext = null;
});

editDelete.addEventListener("click", async () => {
  if (!editingContext) return;
  if (!confirm("Remove this item?")) return;
  if (editingContext.kind === "shared") await deleteShared(editingContext.id);
  else await deleteSecret(editingContext.id);
  editDialog.close();
  editingContext = null;
});

// ============================================================
// Droid easter egg
// ============================================================
droidBtn.addEventListener("click", () => {
  toast(DROID_LINES[Math.floor(Math.random() * DROID_LINES.length)]);
});

// ============================================================
// Helpers
// ============================================================
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) { return escapeHTML(str); }
