"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apiKey: string | null;
  updateUserApiKey: (key: string) => Promise<void>;
  signUpUser: (email: string, password: string) => Promise<void>;
  signInUser: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Set up real-time listener for user profile in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        
        // Initial fetch
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            // Create user document if it doesn't exist
            await setDoc(userDocRef, { apiKey: "" }, { merge: true });
            setApiKey("");
          } else {
            setApiKey(userDoc.data()?.apiKey || "");
          }
        } catch (error) {
          console.error("Error checking user doc:", error);
        }

        // Realtime listener
        const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setApiKey(docSnap.data()?.apiKey || "");
          }
        });

        setLoading(false);
        return () => unsubscribeDoc();
      } else {
        setApiKey(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signUpUser = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create firestore document
      const userDocRef = doc(db, "users", userCredential.user.uid);
      await setDoc(userDocRef, { apiKey: "" }, { merge: true });
    } finally {
      setLoading(false);
    }
  };

  const signInUser = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const updateUserApiKey = async (newKey: string) => {
    if (!user) throw new Error("No authenticated user");
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, { apiKey: newKey }, { merge: true });
    setApiKey(newKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        apiKey,
        updateUserApiKey,
        signUpUser,
        signInUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
