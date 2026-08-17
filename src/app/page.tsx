"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiConfig, fetchBreads, rpc } from "@/lib/api";
import { formatLei } from "@/lib/format";
import type { Bread, PublicConfig } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500";

const inputClass = fieldClass + " uppercase tracking-widest";

export default function Home() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [breads, setBreads] = useState<Bread[]>([]);
  const [config, setConfig] = useState<PublicConfig>({
    banner: null,
    ordering_open: true,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [taves, setTaves] = useState<Record<string, boolean>>({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedCode, setPlacedCode] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("pdc_last_code");
      if (stored) setLastCode(stored);
    } catch {
      // localStorage indisponibil
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await apiConfig();
        if (cancelled) return;
        if (!cfg) {
          setConfigured(false);
          return;
        }
        setConfigured(true);
        const [bRes, cRes] = await Promise.all([
          fetchBreads(),
          rpc<PublicConfig>("get_public_config", {}),
        ]);
        if (cancelled) return;
        if (bRes.error) setLoadError(bRes.error);
        else setBreads(bRes.data ?? []);
        if (cRes.error) setLoadError(cRes.error);
        else if (cRes.data) setConfig(cRes.data);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => {
    let t = 0;
    for (const b of breads) t += (qtys[b.id] ?? 0) * b.price;
    return t;
  }, [breads, qtys]);

  const itemCount = useMemo(
    () => Object.values(qtys).reduce((a, b) => a + b, 0),
    [qtys]
  );

  if (configured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Se încarcă...
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Aplicația nu este configurată</h1>
        <p className="mt-3 text-sm text-stone-600">
          Setează variabilele de mediu{" "}
          <code className="rounded bg-stone-100 px-1">ANON_KEY</code>,{" "}
          <code className="rounded bg-stone-100 px-1">PUBLIC_REST_URL</code> și{" "}
          <code className="rounded bg-stone-100 px-1">
            PUBLIC_STORAGE_URL
          </code>{" "}
          pentru serviciul <code className="rounded bg-stone-100 px-1">app</code>,
          apoi repornește stack-ul.
        </p>
      </div>
    );
  }

  if (placedCode) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm">
          <div className="text-5xl">🎂</div>
          <h1 className="mt-4 text-xl font-semibold">Comanda a fost plasată!</h1>
          <p className="mt-2 text-stone-600">
            Codul tău de urmărire este
          </p>
          <div className="my-6 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-6 py-4 font-mono text-4xl font-bold tracking-[0.3em] text-amber-800">
            {placedCode}
          </div>
          <p className="text-sm text-stone-600">
            Cu acest cod poți verifica oricând dacă painea ta a fost livrată.
            Ține-l deoparte!
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/o/${placedCode}`}
              className="w-full rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white"
            >
              Vezi statusul comenzii
            </Link>
            <button
              onClick={() => setPlacedCode(null)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 font-semibold"
            >
              Mai fac o comandă
            </button>
          </div>
        </div>
      </div>
    );
  }

  const setQty = (id: string, v: number) => {
    const q = Math.max(0, Math.min(99, v));
    setQtys((p) => ({ ...p, [id]: q }));
    if (q === 0) setTaves((p) => ({ ...p, [id]: false }));
  };

  const setTava = (id: string, v: boolean) => setTaves((p) => ({ ...p, [id]: v }));

  const submit = async () => {
    setError(null);
    setPlacing(true);
    const items = breads
      .filter((b) => (qtys[b.id] ?? 0) > 0)
      .map((b) => ({
        bread_id: b.id,
        qty: qtys[b.id],
        la_tava: !!(taves[b.id] && b.available_in_tava !== false),
      }));
    const { data, error: e } = await rpc<{ code: string }>("place_order", {
      p_name: name,
      p_phone: phone,
      p_address: address,
      p_notes: notes,
      p_items: items,
    });
    if (e || !data) {
      setError(e ?? "A apărut o eroare.");
      setPlacing(false);
      return;
    }
    try {
      window.localStorage.setItem("pdc_last_code", data.code);
      setLastCode(data.code);
    } catch {
      // ignor
    }
    setPlacedCode(data.code);
    setPlacing(false);
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900">Paine de Casa</h1>
        <p className="mt-1 text-stone-600">
          Paine proaspata, la comanda. Alege ce vrei, lasa datele, primesti un
          cod de urmarire.
        </p>
      </header>

      {config.banner ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {config.banner}
        </div>
      ) : null}

      {loadError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Nu am putut incarca catalogul: {loadError}
        </div>
      ) : null}

      {!config.ordering_open ? (
        <div className="mb-6 rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Comenzile sunt inchise momentan. Incearca mai tarziu.
        </div>
      ) : null}

      {lastCode ? (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div className="text-sm text-stone-600">
            Comanda ta:{" "}
            <Link
              href={`/o/${lastCode}`}
              className="font-mono font-bold text-stone-900 underline"
            >
              {lastCode}
            </Link>
          </div>
          <button
            onClick={() => {
              setLastCode(null);
              try {
                window.localStorage.removeItem("pdc_last_code");
              } catch {
                // ignor
              }
            }}
            className="text-sm text-stone-400"
            aria-label="Ascunde codul ultimei comenzi"
          >
            ✕
          </button>
        </div>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold text-stone-900">Catalogul</h2>
      {breads.length === 0 && !loadError ? (
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-stone-500">
          Catalogul e gol momentan.
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        {breads.map((b) => {
          const q = qtys[b.id] ?? 0;
          return (
            <div
              key={b.id}
              className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-3"
            >
              {b.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.photo_url}
                  alt={b.name}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">
                  🍞
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-stone-900">{b.name}</div>
                {b.weight_g > 0 ? (
                  <div className="text-sm text-stone-500">{b.weight_g} g</div>
                ) : null}
                {b.description ? (
                  <div className="mt-0.5 line-clamp-2 text-xs text-stone-500">
                    {b.description}
                  </div>
                ) : null}
                <div className="mt-1 font-semibold text-amber-700">
                  {formatLei(b.price)}
                </div>
                {q > 0 && b.available_in_tava !== false ? (
                  <button
                    onClick={() => setTava(b.id, !(taves[b.id] ?? false))}
                    disabled={!config.ordering_open}
                    aria-pressed={!!taves[b.id]}
                    className={`mt-1.5 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
                      taves[b.id]
                        ? "bg-amber-600 text-white"
                        : "border border-stone-300 text-stone-500"
                    }`}
                  >
                    {taves[b.id] ? "Paine la tava ✓" : "Paine la tava?"}
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(b.id, q - 1)}
                    disabled={q <= 0}
                    className="h-9 w-9 rounded-full border border-stone-300 text-lg font-bold disabled:opacity-30"
                    aria-label={`Scade cantitatea pentru ${b.name}`}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{q}</span>
                  <button
                    onClick={() => setQty(b.id, q + 1)}
                    disabled={!config.ordering_open || q >= 99}
                    className="h-9 w-9 rounded-full bg-stone-800 text-lg font-bold text-white disabled:opacity-30"
                    aria-label={`Creste cantitatea pentru ${b.name}`}
                  >
                    +
                  </button>
                </div>
                {q > 0 ? (
                  <div className="mt-1 text-xs font-semibold text-stone-600">
                    {formatLei(q * b.price)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-stone-900">
        Datele tale
      </h2>
      <div className="flex flex-col gap-3">
        <input
          className={fieldClass}
          placeholder="Nume"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Telefon"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Adresa de livrare"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <textarea
          className={fieldClass}
          placeholder="Note (optional): eticheta, instructiuni la livrare..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-4 px-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-stone-500">
                {itemCount === 1 ? "1 piesa" : `${itemCount} piese`},{" "}
                {formatLei(total)}
              </div>
              {name.trim() === "" ||
              phone.trim() === "" ||
              address.trim() === "" ? (
                <div className="mt-0.5 text-xs text-stone-400">
                  Completeaza numele, telefonul si adresa.
                </div>
              ) : null}
            </div>
            <button
              onClick={submit}
              disabled={
                placing ||
                !config.ordering_open ||
                name.trim() === "" ||
                phone.trim() === "" ||
                address.trim() === ""
              }
              className="rounded-2xl bg-amber-600 px-6 py-4 text-lg font-semibold text-white disabled:opacity-40"
            >
              {placing ? "Se trimite..." : "Plasează comanda"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
