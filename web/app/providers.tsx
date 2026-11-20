"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSessionVersion, subscribeSession } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(subscribeSession, getSessionVersion, () => 0);
  return <SessionProviders version={version}>{children}</SessionProviders>;
}

function SessionProviders({ children, version }: { children: ReactNode; version: number }) {
  const [client] = useState(() => new QueryClient());
  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    client.clear();
  }, [client, version]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
