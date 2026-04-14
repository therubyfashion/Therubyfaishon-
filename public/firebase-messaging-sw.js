importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBC_LcAaAgsXx17A9kcrX9NM5JPTAZrFYQ",
  authDomain: "gen-lang-client-0266079178.firebaseapp.com",
  projectId: "gen-lang-client-0266079178",
  storageBucket: "gen-lang-client-0266079178.firebasestorage.app",
  messagingSenderId: "987019399933",
  appId: "1:987019399933:web:bcb3ccc92f77ed0818a494"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
