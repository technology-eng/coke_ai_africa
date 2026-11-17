import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { appBase, brandTitle, getRegion, regionInfo } from "@/lib/region";
import { queryClient } from "@/lib/queryClient";
import "./index.css";

// One build serves every region folder, so the tab is named from the URL too.
document.title = getRegion() === "PROTEIN" ? `${brandTitle()} — MaxDiff` : `Coke ${regionInfo().tab} — MaxDiff`;
// Lets index.css swap the brand colours per region.
document.documentElement.dataset.region = getRegion();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename={appBase()}>
      <App />
      {/* richColors paints error toasts red, which the protein dashboard avoids. */}
      <Toaster position="top-right" richColors={getRegion() !== "PROTEIN"} closeButton />
    </BrowserRouter>
  </QueryClientProvider>
);
