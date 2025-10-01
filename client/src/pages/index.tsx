import { createHashRouter } from "react-router-dom";
import DashBoard from "./Dashboard";
import ExperimentBuilder from "./ExperimentBuilder";
import PluginsProvider from "./ExperimentBuilder/providers/PluginsProvider";
import DevModeProvider from "./ExperimentBuilder/providers/DevModeProvider";
import ProtectedRoute from "../components/ProtectedRoute";
import LandingPage from "./LandingPage";
import Register from "./Auth/Register";
import Login from "./Auth/Login";

// import ProtectedRoute from "../components/ProtectedRoute";

const router = createHashRouter([
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
      <ProtectedRoute>
        <DashBoard />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashBoard />,
      },
      {
        path: "settings",
        element: <DashBoard />,
      },
      {
        path: "experimet/:id",
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
