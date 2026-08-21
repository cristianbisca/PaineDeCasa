import { connection } from "next/server";
import Home from "@/components/home";

export default async function Page() {
  await connection();
  return <Home />;
}
