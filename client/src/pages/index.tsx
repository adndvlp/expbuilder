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
import Settings from "./Settings";
import GoogleDriveCallback from "./Settings/GoogleDriveCallback";
import DropboxCallback from "./Settings/DropboxCallback";
import GithubCallback from "./Settings/GithubCallback";

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
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
    index: true,
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/google-drive-callback",
    element: <GoogleDriveCallback />,
  },
  {
    path: "/dropbox-callback",
    element: <DropboxCallback />,
  },
  {
    path: "/github-callback",
    element: <GithubCallback />,
  },
  {
    path: "/home/experiment/:id",
    element: (
      <ProtectedRoute>
        <DevModeProvider>
          <PluginsProvider>
            <ExperimentBuilder />
          </PluginsProvider>
        </DevModeProvider>
      </ProtectedRoute>
    ),
  },
]);

export default router;
