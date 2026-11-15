import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";
import { DemoBar } from "./components/DemoBar";
import { AuthProvider } from "./lib/AuthProvider";
import { OrgProvider } from "./lib/OrgProvider";
import { DEMO_MODE } from "./lib/supabase";
import { router } from "./routes/router";

export default function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  const [appRouter] = useState(router);
  return (
    <QueryClientProvider client={queryClient}>
      <OrgProvider>
        <AuthProvider>
          {DEMO_MODE && <DemoBar />}
          <RouterProvider router={appRouter} />
        </AuthProvider>
      </OrgProvider>
    </QueryClientProvider>
  );
}
