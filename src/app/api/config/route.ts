import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    restUrl: process.env.PUBLIC_REST_URL ?? "",
    storageUrl: process.env.PUBLIC_STORAGE_URL ?? "",
    anonKey: process.env.ANON_KEY ?? "",
  });
}
