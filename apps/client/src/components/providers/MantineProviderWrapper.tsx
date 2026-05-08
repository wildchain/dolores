"use client";

import { MantineProvider } from "@mantine/core";

export function MantineProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MantineProvider>{children}</MantineProvider>;
}
