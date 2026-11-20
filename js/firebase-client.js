import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import {
  FIREBASE_CONFIG,
  isFirebaseConfigured
} from "./firebase-config.js";

let app = null;
let auth = null;
let db = null;
let persistenceReady = Promise.resolve(false);

if (isFirebaseConfigured()) {
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  auth.languageCode = "es";

  persistenceReady = setPersistence(
    auth,
    browserLocalPersistence
  )
    .then(() => true)
    .catch(error => {
      console.warn(
        "No se pudo activar persistencia local de Firebase Auth.",
        error
      );
      return false;
    });
}

export {
  app,
  auth,
  db,
  persistenceReady
};

export function firebaseReady() {
  return Boolean(app && auth && db);
}
