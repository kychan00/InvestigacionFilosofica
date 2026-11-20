export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyBNCwpa3bTMBUIC6GSXTDmoFpqik4WOyzs",
  authDomain: "investigacion-filosofica.firebaseapp.com",
  projectId: "investigacion-filosofica",
  storageBucket: "investigacion-filosofica.firebasestorage.app",
  messagingSenderId: "1020802513809",
  appId: "1:1020802513809:web:9ef743ff0b5a1654873830"
});

export function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
  );
}
