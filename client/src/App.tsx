import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import Home from "./screens/home";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <RouterProvider
      router={router}
      // Opt into v7 behaviors early to remove console warnings
      // These flags are safe no-op once v7 is the default
      future={{ v7_startTransition: true, v7_relativeSplatPath: true } as any}
    />
  );
}
