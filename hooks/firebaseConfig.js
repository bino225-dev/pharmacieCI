import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCmu8mRkq-IyhDpKrxN9qL1-u3Xf43P4PU",
  authDomain: "spotboxlive-music.firebaseapp.com",
  databaseURL: "https://spotboxlive-music.firebaseio.com",
  projectId: "spotboxlive-music",
  storageBucket: "spotboxlive-music.firebasestorage.app",
  messagingSenderId: "795201876769",
  appId: "1:795201876769:web:1e0a1a14919612e16fc460",
  measurementId: "G-FYFNBD4YFC"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { auth, db, functions, httpsCallable };
