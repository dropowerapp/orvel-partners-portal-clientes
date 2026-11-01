import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";
import { AuthProvider } from "./lib/AuthProvider";
import { OrgProvider } from "./lib/OrgProvider";
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
          <RouterProvider router={appRouter} />
        </AuthProvider>
      </OrgProvider>
    </QueryClientProvider>
  );
}
