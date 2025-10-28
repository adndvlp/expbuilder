import { Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";

type Props = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: Props) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "6px solid #eee",
            borderTop: "6px solid #d4af37",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
