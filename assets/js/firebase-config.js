// Firebase Configuration
// Reemplaza estos valores con la configuración real de tu proyecto Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyDzB3xUJGKD72faL4rjo2ndcjaTLT5nyiA",
  authDomain: "modalab-finance.firebaseapp.com",
  projectId: "modalab-finance",
  storageBucket: "modalab-finance.firebasestorage.app",
  messagingSenderId: "995011713987",
  appId: "1:995011713987:web:5e5cd9dcc8068157b5bb76",
  measurementId: "G-1CBX97YDRT"
};

// Inicializar Firebase y Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
