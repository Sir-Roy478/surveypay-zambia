// Firebase SDKs are loaded via <script> tags in each HTML page.
// This file just initializes the app with your config.
// All pages share this one file - no need to copy config anywhere else.

 const firebaseConfig = {

    apiKey: "AIzaSyBSEUcyyRYYp-hyOVwviid5D9oKCZfFI_Q",

    authDomain: "surveyzambia-e9ff8.firebaseapp.com",

    projectId: "surveyzambia-e9ff8",

    storageBucket: "surveyzambia-e9ff8.firebasestorage.app",

    messagingSenderId: "606855532777",

    appId: "1:606855532777:web:e84aea970ee6ef75eea078"

  };


firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();