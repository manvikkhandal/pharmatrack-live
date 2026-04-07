import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB-5DagE50hE_AOknhX12CL_c6jBqnmrK8",
  authDomain: "pharma-force-india.firebaseapp.com",
  projectId: "pharma-force-india",
  storageBucket: "pharma-force-india.firebasestorage.app",
  messagingSenderId: "1007373967907",
  appId: "1:1007373967907:web:255c1df5fc879665420796",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
