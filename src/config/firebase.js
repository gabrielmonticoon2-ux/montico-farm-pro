import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyCXRYHn4-Srgk-VCyffGishQAo8jH25ys',
  authDomain:        'montico-farm-pro.firebaseapp.com',
  projectId:         'montico-farm-pro',
  storageBucket:     'montico-farm-pro.firebasestorage.app',
  messagingSenderId: '172504990401',
  appId:             '1:172504990401:web:fb9941f2db2767d5354a40',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
