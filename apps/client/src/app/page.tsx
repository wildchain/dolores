import Landing from "@/app/landing/page";
import { redirect } from "next/navigation";

export default function Home() {
  return redirect("/landing.html");
}
