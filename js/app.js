import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// ============================================================
// FIREBASE SETUP
// ============================================================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const itemsCol = collection(db, "wishlist_items");


// ============================================================
// FIREBASE USER IDS
// ============================================================

const USERS = {
  padme: "lUlrBxUSMtg2M4oIscxeybT8wOJ2",
  anakin: "YiseNexpFLP8GP4OLQYDb7KV4Li2"
};


// ============================================================
// ACCOUNT EMAILS
// ============================================================

const ACCOUNT_EMAILS = {
  padme: "mel.bauerr@gmail.com",
  anakin: "johnny.zammit03@gmail.com"
};


// ============================================================
// PAGE ELEMENTS
// ============================================================

const gateEl = document.getElementById("gate");
const appEl = document.getElementById("app");
const gateNote = document.getElementById("gateNote");
const viewerEyebrow = document.getElementById("viewerEyebrow");
const switchBtn = document.getElementById("switchBtn");

const itemOwner = document.getElementById("itemOwner");
const itemTitle = document.getElementById("itemTitle");
const itemUrl = document.getElementById("itemUrl");
const itemNote = document.getElementById("itemNote");
const addItemBtn = document.getElementById("addItemBtn");

const secretLabel = document.getElementById("secretLabel");


// ============================================================
// CURRENT USER
// ============================================================

let viewer = null;

let allItems = [];


// ============================================================
// LOGIN
// ============================================================

async function loginAs(who) {

  const email = ACCOUNT_EMAILS[who];

  if (!email) {
    gateNote.textContent = "Account email is missing in app.js.";
    return;
  }

  const password = prompt(
    `Enter the password for ${
      who === "anakin" ? "Anakin" : "Padmé"
    }:`
  );

  if (!password) {
    return;
  }

  gateNote.textContent = "Signing in...";

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (err) {

    console.error("Login error:", err);

    gateNote.textContent =
      "Login failed. Please check the password.";

  }
}


// ============================================================
// LOGIN BUTTONS
// ============================================================

document
  .querySelectorAll(".who-btn")
  .forEach((button) => {

    button.addEventListener("click", () => {

      loginAs(button.dataset.who);

    });

  });


// ============================================================
// AUTHENTICATION STATE
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {

    viewer = null;

    gateEl.classList.remove("hidden");

    appEl.classList.add("hidden");

    return;
  }


  if (user.uid === USERS.padme) {

    viewer = "padme";

  } else if (user.uid === USERS.anakin) {

    viewer = "anakin";

  } else {

    console.error(
      "Unknown Firebase user:",
      user.uid
    );

    signOut(auth);

    return;
  }


  // Show the app

  gateEl.classList.add("hidden");

  appEl.classList.remove("hidden");


  // Show current user

  viewerEyebrow.textContent =
    `viewing as ${
      viewer === "anakin"
        ? "Anakin"
        : "Padmé"
    }`;


  // Default add destination to own list

  itemOwner.value = viewer;


  updateSecretLabel();

  render();

});


// ============================================================
// SECRET LABEL
// ============================================================

function updateSecretLabel() {

  if (viewer === "padme") {

    secretLabel.textContent =
      "Secret gift - Anakin won't see this";

  } else {

    secretLabel.textContent =
      "Secret gift - Padmé won't see this";

  }

}


// ============================================================
// SIGN OUT
// ============================================================

switchBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (err) {

      console.error(
        "Sign out error:",
        err
      );

    }

  }
);


// ============================================================
// FIRESTORE LISTENER
// ============================================================

const q = query(
  itemsCol,
  orderBy("createdAt", "desc")
);

onSnapshot(
  q,

  (snapshot) => {

    allItems = snapshot.docs.map((document) => ({

      id: document.id,

      ...document.data()

    }));

    render();

  },

  (err) => {

    console.error(
      "Firestore error:",
      err
    );

    gateNote.textContent =
      "Couldn't connect to the shared list. Check your Firebase setup and Firestore rules.";

  }
);


// ============================================================
// ADD ITEM
// ============================================================

addItemBtn.addEventListener(
  "click",
  async () => {

    if (!viewer) {

      alert("Please sign in first.");

      return;

    }


    const owner =
      itemOwner.value;

    const title =
      itemTitle.value.trim();

    const note =
      itemNote.value.trim();


    // Make sure there is a title

    if (!title) {

      itemTitle.focus();

      return;

    }


    // Get selected visibility

    const visibility =
      document.querySelector(
        'input[name="visibility"]:checked'
      )?.value || "visible";


    // Clean URL

    let url =
      itemUrl.value.trim();

    if (
      url &&
      !/^https?:\/\//i.test(url)
    ) {

      url =
        "https://" + url;

    }


    addItemBtn.disabled = true;

    addItemBtn.textContent =
      "Adding...";


    try {

      await addDoc(
        itemsCol,
        {

          owner: owner,

          addedBy: viewer,

          visibility: visibility,

          title: title,

          url: url || null,

          note: note || null,

          reservedBy: null,

          createdAt: serverTimestamp()

        }
      );


      // Clear fields

      itemTitle.value = "";

      itemUrl.value = "";

      itemNote.value = "";


      // Reset visibility

      const visibleRadio =
        document.querySelector(
          'input[name="visibility"][value="visible"]'
        );

      if (visibleRadio) {

        visibleRadio.checked = true;

      }


      // Return owner selection to
      // the current user's own list

      itemOwner.value = viewer;


      itemTitle.focus();


    } catch (err) {

      console.error(
        "Add item error:",
        err
      );

      alert(
        "Couldn't add that item. Check your Firebase setup."
      );

    } finally {

      addItemBtn.disabled = false;

      addItemBtn.textContent =
        "Add to the list";

    }

  }
);


// ============================================================
// ENTER KEY SUPPORT
// ============================================================

[
  itemTitle,
  itemUrl,
  itemNote
].forEach((input) => {

  input.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {

        addItemBtn.click();

      }

    }
  );

});


// ============================================================
// RESERVE / UNRESERVE
// ============================================================

async function toggleReserve(
  itemId,
  currentlyReservedBy
) {

  if (!viewer) {
    return;
  }


  const item =
    allItems.find(
      (item) => item.id === itemId
    );


  if (!item) {
    return;
  }


  // You can only reserve
  // something from your partner's list.

  if (item.owner === viewer) {

    alert(
      "You can't reserve items on your own list."
    );

    return;

  }


  const ref =
    doc(
      db,
      "wishlist_items",
      itemId
    );


  const newReservedBy =
    currentlyReservedBy === viewer
      ? null
      : viewer;


  try {

    await updateDoc(
      ref,
      {
        reservedBy: newReservedBy
      }
    );

  } catch (err) {

    console.error(
      "Reserve error:",
      err
    );

    alert(
      "Couldn't update that item."
    );

  }

}


// ============================================================
// DELETE ITEM
// ============================================================

async function deleteItem(itemId) {

  if (!viewer) {
    return;
  }


  const item =
    allItems.find(
      (item) => item.id === itemId
    );


  if (!item) {
    return;
  }


  // You can delete something if:
  //
  // 1. It is your own wishlist item
  //
  // OR
  //
  // 2. You were the person who added it.

  if (
    item.owner !== viewer &&
    item.addedBy !== viewer
  ) {

    alert(
      "You can only remove items you added."
    );

    return;

  }


  if (
    !confirm(
      "Remove this item from the list?"
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "wishlist_items",
        itemId
      )
    );

  } catch (err) {

    console.error(
      "Delete error:",
      err
    );

    alert(
      "Couldn't remove that item."
    );

  }

}


// ============================================================
// ITEM VISIBILITY
// ============================================================

function canSeeItem(item) {

  const visibility =
    item.visibility || "visible";


  // Normal item:
  // both people can see it.

  if (visibility === "visible") {

    return true;

  }


  // Secret item:
  // only the person who added it
  // can see it.

  return item.addedBy === viewer;

}


// ============================================================
// CREATE ITEM HTML
// ============================================================

function itemHTML(item) {

  const isOwnList =
    item.owner === viewer;


  let linkTitle;


  if (item.url) {

    linkTitle = `
      <a
        href="${escapeAttr(item.url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHTML(item.title)}
      </a>
    `;

  } else {

    linkTitle =
      escapeHTML(item.title);

  }


  let footRight = "";


  // ==========================================================
  // YOUR OWN LIST
  // ==========================================================

  if (isOwnList) {

    /*
      This is your wishlist.

      You can remove your own items.

      You do NOT see whether your partner
      has reserved/bought this item.
    */

    footRight = `

      <button
        class="delete-btn"
        data-action="delete"
        data-id="${item.id}"
      >
        remove
      </button>

    `;

  }


  // ==========================================================
  // PARTNER'S LIST
  // ==========================================================

  else {

    /*
      This is your partner's wishlist.

      You are buying for them.

      Therefore you CAN see reservation status.
    */

    const reservedByViewer =
      item.reservedBy === viewer;


    const reservedByOther =
      item.reservedBy &&
      item.reservedBy !== viewer;


    if (reservedByOther) {

      footRight = `

        <span class="reserved-tag">
          someone's on it
        </span>

      `;

    } else {

      footRight = `

        <button
          class="reserve-btn ${
            reservedByViewer
              ? "reserved"
              : ""
          }"
          data-action="reserve"
          data-id="${item.id}"
          data-reserved-by="${
            item.reservedBy || ""
          }"
        >

          ${
            reservedByViewer
              ? "I've got this ✓"
              : "I'll get this"
          }

        </button>

      `;

    }

  }


  return `

    <li class="item">

      <p class="item-title">
        ${linkTitle}
      </p>

      ${
        item.note
          ? `
            <p class="item-note">
              ${escapeHTML(item.note)}
            </p>
          `
          : ""
      }

      <div class="item-foot">

        ${footRight}

      </div>

    </li>

  `;

}


// ============================================================
// RENDER BOTH LISTS
// ============================================================

function render() {

  if (!viewer) {
    return;
  }


  [
    "anakin",
    "padme"
  ].forEach((owner) => {


    const listEl =
      document.querySelector(
        `.items[data-list-for="${owner}"]`
      );


    const emptyEl =
      document.querySelector(
        `.empty-state[data-empty-for="${owner}"]`
      );


    if (!listEl) {
      return;
    }


    const items =
      allItems

        .filter(
          (item) =>
            item.owner === owner
        )

        .filter(canSeeItem);


    listEl.innerHTML =
      items
        .map(itemHTML)
        .join("");


    if (emptyEl) {

      emptyEl.style.display =
        items.length
          ? "none"
          : "block";

    }

  });


  // ==========================================================
  // RESERVE BUTTONS
  // ==========================================================

  document
    .querySelectorAll(
      '[data-action="reserve"]'
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          toggleReserve(
            button.dataset.id,
            button.dataset.reservedBy || null
          );

        }
      );

    });


  // ==========================================================
  // DELETE BUTTONS
  // ==========================================================

  document
    .querySelectorAll(
      '[data-action="delete"]'
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          deleteItem(
            button.dataset.id
          );

        }
      );

    });

}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHTML(str) {

  return String(str).replace(
    /[&<>"']/g,
    (character) => ({

      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"

    }[character])
  );

}


function escapeAttr(str) {

  return escapeHTML(str);

}