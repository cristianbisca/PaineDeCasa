"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { rpc } from "@/lib/api";
import { formatDate, formatLei } from "@/lib/format";
import type { OrderInfo } from "@/lib/types";

type StatusData = OrderInfo & {
  status: "pending" | "accepted" | "delivered" | "cancelled";
};

export default function OrderStatusPage() {
  const pathname = usePathname();
  const code = (pathname.split("/").filter(Boolean).pop() ?? "").toUpperCase();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: d, error: e } = await rpc<StatusData>("get_order_by_code", {
        p_code: code,
      });
      if (cancelled) return;
      if (e) setError(e);
      else setData(d);
      setLoading(false);
    }
    if (!code) {
      setLoading(false);
      return;
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Se încarcă...
      </div>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full rounded-3xl bg-white p-8">
          <h1 className="text-xl font-semibold">Comandă necunoscută</h1>
          <p className="mt-2 text-stone-600">
            {error ?? "Nu am găsit nicio comandă cu acest cod."} Verifică
            codul și încearcă din nou.
          </p>
          <Link
            href="/o"
            className="mt-6 block w-full rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white"
          >
            Alt cod
          </Link>
        </div>
      </main>
    );
  }

  const delivered = data.status === "delivered";
  const cancelled = data.status === "cancelled";
  const accepted = data.status === "accepted";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <div
        className={`rounded-3xl p-8 text-center ${
          delivered
            ? "bg-green-600"
            : cancelled
              ? "bg-stone-700"
              : accepted
                ? "bg-sky-600"
                : "bg-amber-500"
        } text-white`}
      >
        <div className="text-4xl">
          {delivered ? "✅" : cancelled ? "✖" : accepted ? "🍞" : "⏳"}
        </div>
        <h1 className="mt-3 text-2xl font-bold">
          {delivered
            ? "Livrata!"
            : cancelled
              ? "Comanda anulata"
              : accepted
                ? "Preluata!"
                : "In asteptare"}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          {delivered
            ? `Livrata pe ${formatDate(data.delivered_at)}`
            : cancelled
              ? "Brutarul a anulat comanda. Te rugam sa ne suni pentru detalii."
              : accepted
                ? "Brutarul a vazut comanda. O pregatim pentru livrare."
                : "Painea ta urmeaza sa fie preparata si livrata."}
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-white p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">Cod comandă</span>
          <span className="font-mono text-lg font-bold tracking-widest">
            {data.code}
          </span>
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <div className="text-sm font-semibold text-stone-900">
            {data.name}
          </div>
          <div className="mt-1 text-sm text-stone-600">{data.address}</div>
        </div>
        {data.accepted_at ? (
          <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Preluata de brutar pe {formatDate(data.accepted_at)}.
          </div>
        ) : null}
        {data.notes ? (
          <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
            {data.notes}
          </div>
        ) : null}
        <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
          {data.items.map((it) => (
            <div key={it.bread_id} className="flex justify-between text-sm">
              <span>
                {it.name} × {it.qty}
                {it.la_tava ? (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    la tavă
                  </span>
                ) : null}
              </span>
              <span className="font-semibold">{formatLei(it.row_total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-stone-100 pt-4">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-amber-700">
            {formatLei(data.total)}
          </span>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Comanda plasata pe {formatDate(data.created_at)}. Se actualizeaza
          automat.
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 block rounded-xl border border-stone-300 px-4 py-3 text-center font-semibold"
      >
        Înapoi la comenzi
      </Link>
    </main>
  );
}
