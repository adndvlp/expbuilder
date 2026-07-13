import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import type { Experiment, SettingsNotification } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export function useSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notification, setNotification] = useState<SettingsNotification | null>(
    null,
  );
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/load-experiments`)
      .then((response) => response.json())
      .then((data) => setExperiments(data.experiments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    const service = searchParams.get("service");
    const errorMessage = searchParams.get("message");
    if (!status || !service) return;

    if (status === "success") {
      setNotification({
        type: "success",
        message: `${service.charAt(0).toUpperCase() + service.slice(1)} connected successfully!`,
      });
    } else if (status === "error") {
      setNotification({
        type: "error",
        message: `Error connecting ${service}: ${errorMessage || "Unknown error"}`,
      });
    }
    setSearchParams({});
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await auth.signOut();
      localStorage.removeItem("user");
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    user,
    authLoading,
    notification,
    setNotification,
    experiments,
    isLoggingOut,
    handleLogout,
  };
}
