import { createHashRouter } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Dashboard from "./Dashboard";
import ExperimentBuilder from "./ExperimentBuilder";
import PluginsProvider from "./ExperimentBuilder/providers/PluginsProvider";
import DevModeProvider from "./ExperimentBuilder/providers/DevModeProvider";
// import ProtectedRoute from "../components/ProtectedRoute";
import LandingPage from "./LandingPage";
import Register from "./Auth/Register";
import Login from "./Auth/Login";
import ErrorDetail from "./ErrorDetail";
import Settings from "./Settings";
import GoogleDriveCallback from "./Settings/GoogleDrive/GoogleDriveCallback";
import DropboxCallback from "./Settings/Dropbox/DropboxCallback";
import GithubCallback from "./Settings/Github/GithubCallback";
import OsfCallback from "./Settings/OsfCallback";
import ExperimentPanel from "./ExperimentPanel";
import Docs from "./Docs";

// import ProtectedRoute from "../components/ProtectedRoute";

const router = createHashRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorDetail />,
    children: [
      {
        path: "/",
        element: <LandingPage />,
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
      },
      {
        path: "/settings",
        element: (
          // <ProtectedRoute>
          <Settings />
          // </ProtectedRoute>
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
        path: "/oauth/osf/callback",
        element: <OsfCallback />,
      },
      {
        path: "/docs",
        element: <Docs />,
      },
      {
        path: "/home/experiment/:id",
        element: <ExperimentPanel />,
      },
      {
        path: "/home/experiment/:id/builder",
        element: (
          <DevModeProvider>
            <PluginsProvider>
              <ExperimentBuilder />
            </PluginsProvider>
          </DevModeProvider>
        ),
      },
    ],
  },
]);

export default router;
