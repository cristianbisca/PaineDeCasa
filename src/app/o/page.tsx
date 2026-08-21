import { connection } from "next/server";
import CodePage from "@/components/order-code";

export default async function Page() {
  await connection();
  return <CodePage />;
}
