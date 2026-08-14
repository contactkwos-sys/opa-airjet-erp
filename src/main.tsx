import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider as ErpAuthProvider } from "@/context/AuthContext";
import { AuthProvider as SecurityAuthProvider } from "./lib/auth.tsx";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SecurityAuthProvider>
        <ErpAuthProvider>
          <App />
        </ErpAuthProvider>
      </SecurityAuthProvider>
    </BrowserRouter>
  </StrictMode>
);
