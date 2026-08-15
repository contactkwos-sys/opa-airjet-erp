import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider as ErpAuthProvider } from "@/context/AuthContext";
import { AuthProvider as SecurityAuthProvider } from "./lib/auth.tsx";
import "./index.css";
import App from "./App.tsx";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

// GitHub Pages 404.html → index SPA restore
try {
  const redirect = sessionStorage.getItem("opa-spa-redirect");
  if (redirect) {
    sessionStorage.removeItem("opa-spa-redirect");
    const base = routerBasename === "/" ? "" : routerBasename;
    if (redirect.startsWith(base) && redirect !== `${base}/` && redirect !== base) {
      history.replaceState(null, "", redirect);
    }
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename === "/" ? undefined : routerBasename}>
      <SecurityAuthProvider>
        <ErpAuthProvider>
          <App />
        </ErpAuthProvider>
      </SecurityAuthProvider>
    </BrowserRouter>
  </StrictMode>
);
