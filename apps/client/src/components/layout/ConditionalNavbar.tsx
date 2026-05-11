"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  if (["/", "/docs/", "/docs"].includes(pathname)) return null;
  return <Navbar />;
}
