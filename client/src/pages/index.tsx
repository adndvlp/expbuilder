import { createBrowserRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import ExperimentBuilder from "./ExperimentBuilder";
import PluginsProvider from "./ExperimentBuilder/providers/PluginsProvider";
import DevModeProvider from "./ExperimentBuilder/providers/DevModeProvider";
import ProtectedRoute from "../components/ProtectedRoute";
import LandingPage from "./LandingPage";
import Register from "./Auth/Register";
import Login from "./Auth/Login";
import ErrorDetail from "./ErrorDetail";

// import ProtectedRoute from "../components/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <ErrorDetail />,
  },
  {
    path: "/auth/register",
    element: <Register />,
  },
  {
    path: "/auth/login",
    element: <Login />,
  },
  {
    path: "/home",
    element: (
      // <ProtectedRoute>
      <Dashboard />
      // </ProtectedRoute>
    ),
    children: [
      {
        index: true,
      },
      {
        path: "settings",
        element: <Dashboard />,
      },
    ],
  },
  {
    path: "/home/experiment/:id",
    element: (
      // <ProtectedRoute>
      <DevModeProvider>
        <PluginsProvider>
          <ExperimentBuilder />
        </PluginsProvider>
      </DevModeProvider>
      // </ProtectedRoute>
    ),
  },
]);

export default router;
