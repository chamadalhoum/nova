import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getSessionVersion, subscribeSession } from "@/lib/api";

export default function RootLayout() {
  const version = useSyncExternalStore(subscribeSession, getSessionVersion, () => 0);
  return <SessionLayout key={version} />;
}

function SessionLayout() {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => { client.clear(); }, [client]);
  return (
    <QueryClientProvider client={client}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
