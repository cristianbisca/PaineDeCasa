import { connection } from "next/server";
import AdminPage from "@/components/admin";

export default async function Page() {
  await connection();
  return <AdminPage />;
}
