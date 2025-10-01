import { Navigate, useParams } from "react-router-dom";
import React from "react";

// Simulación de autenticación (reemplaza con tu lógica real)
function getCurrentUserId() {
  // Ejemplo: obtén el userId desde localStorage o contexto
  return localStorage.getItem("userId");
}

type Props = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: Props) {
  const { userId } = useParams();
  const token = localStorage.getItem("token");
  const currentUserId = getCurrentUserId();

  // Si no hay token, redirige al login
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  // Si la ruta tiene userId y no coincide con el usuario autenticado, redirige al home
  if (userId && currentUserId && userId !== currentUserId) {
    return <Navigate to={`/user/${currentUserId}/home`} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
