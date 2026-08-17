"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc, uploadPhoto } from "@/lib/api";
import { formatDate, formatLei, isToday } from "@/lib/format";
import type { AdminData, Bread, OrderInfo } from "@/lib/types";

type Tab = "orders" | "production" | "catalog" | "settings";

const fieldClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-500";

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [sessionPin, setSessionPin] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResults, setSearchResults] = useState<OrderInfo[] | null>(null);

  // catalog form
  const [editing, setEditing] = useState<Bread | "new" | null>(null);
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fWeight, setFWeight] = useState("");
  const [fPrice, setFPrice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // settings
  const [banner, setBanner] = useState("");
  const [orderingOpen, setOrderingOpen] = useState(true);
  const [newPin, setNewPin] = useState("");

  const loadData = useCallback(async (p: string): Promise<boolean> => {
    const { data: d, error } = await rpc<AdminData>("admin_get_all", {
      p_pin: p,
    });
    if (error) {
      setAuthError(error);
      return false;
    }
    setAuthError(null);
    if (d) {
      setData(d);
      setSessionPin(p);
      try {
        window.localStorage.setItem("pdc_pin", p);
      } catch {
        // ignor
      }
    }
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = window.localStorage.getItem("pdc_pin");
        if (!stored) {
          setLoading(false);
          return;
        }
        const ok = await loadData(stored);
        if (!ok && !cancelled) {
          try {
            window.localStorage.removeItem("pdc_pin");
          } catch {
            // ignor
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (data) {
      setBanner(data.banner ?? "");
      setOrderingOpen(data.ordering_open);
    }
  }, [data]);

  const refresh = async () => {
    if (!sessionPin) return;
    await loadData(sessionPin);
  };

  const login = async () => {
    setAuthError(null);
    await loadData(pin);
  };

  const logout = () => {
    try {
      window.localStorage.removeItem("pdc_pin");
    } catch {
      // ignor
    }
    setData(null);
    setSessionPin("");
    setPin("");
    setTab("orders");
  };

  const markAccepted = async (order: OrderInfo) => {
    setBusy(true);
    setMsg(null);
    const { error } = await rpc<unknown>("mark_accepted", {
      p_code: order.code,
      p_pin: sessionPin,
    });
    if (error) setMsg(error);
    setBusy(false);
    await refresh();
  };

  const markDelivered = async (order: OrderInfo) => {
    setBusy(true);
    setMsg(null);
    const { error } = await rpc<unknown>("mark_delivered", {
      p_code: order.code,
      p_pin: sessionPin,
    });
    if (error) setMsg(error);
    setBusy(false);
    await refresh();
  };

  const search = async () => {
    setMsg(null);
    const { data: d, error } = await rpc<OrderInfo[]>("admin_search", {
      p_pin: sessionPin,
      p_phone: searchPhone,
    });
    if (error) {
      setMsg(error);
      return;
    }
    setSearchResults(d ?? []);
  };

  const startEdit = (b: Bread | "new") => {
    setEditing(b);
    if (b === "new") {
      setFName("");
      setFDesc("");
      setFWeight("");
      setFPrice("");
    } else {
      setFName(b.name);
      setFDesc(b.description);
      setFWeight(String(b.weight_g || ""));
      setFPrice(String(b.price));
    }
    setMsg(null);
  };

  const saveBread = async () => {
    setBusy(true);
    setMsg(null);
    let photoUrl: string | null =
      editing === "new" ? null : (editing as Bread).photo_url;
    const file = fileRef.current?.files?.[0];
    if (file) {
      const up = await uploadPhoto(file);
      if (up.error) {
        setMsg(`Urcare imagine: ${up.error}`);
        setBusy(false);
        return;
      }
      photoUrl = up.url;
    }
    const price = parseFloat(fPrice.replace(",", "."));
    const { error } = await rpc<unknown>("upsert_bread", {
      p_pin: sessionPin,
      p_id: editing === "new" ? null : (editing as Bread).id,
      p_name: fName,
      p_description: fDesc,
      p_weight_g: parseInt(fWeight, 10) || 0,
      p_price: isNaN(price) ? 0 : price,
      p_photo_url: photoUrl,
    });
    if (error) {
      setMsg(error);
      setBusy(false);
      return;
    }
    setEditing(null);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    await refresh();
  };

  const toggleActive = async (b: Bread) => {
    setBusy(true);
    setMsg(null);
    const { error } = await rpc<unknown>("set_bread_active", {
      p_pin: sessionPin,
      p_id: b.id,
      p_active: !b.active,
    });
    if (error) setMsg(error);
    setBusy(false);
    await refresh();
  };

  const saveSettings = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await rpc<unknown>("set_config", {
      p_pin: sessionPin,
      p_banner: banner,
      p_ordering_open: orderingOpen,
      p_pin_new: newPin || null,
    });
    if (error) {
      setMsg(error);
      setBusy(false);
      return;
    }
    setMsg("Salvat.");
    setNewPin("");
    setBusy(false);
    await refresh();
  };

  const grouped = useMemo(() => {
    const m = new Map<string, OrderInfo[]>();
    for (const o of data?.pending ?? []) {
      const k = o.address.trim() || "Fără adresă";
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "ro"));
  }, [data]);

  const acceptedCount = useMemo(
    () => (data?.pending ?? []).filter((o) => o.accepted_at).length,
    [data]
  );

  const deliveredToday = useMemo(
    () => (data?.delivered ?? []).filter((o) => isToday(o.delivered_at)).length,
    [data]
  );

  const pendingTotal = useMemo(
    () => (data?.pending ?? []).reduce((a, o) => a + o.total, 0),
    [data]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Se încarcă...
      </div>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-bold text-stone-900">Paine de Casa</h1>
        <p className="mt-1 text-stone-600">Panoul brutarului</p>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          className="mt-8 w-full rounded-2xl border-2 border-stone-300 bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          onClick={login}
          disabled={pin.length < 4}
          className="mt-4 w-full rounded-2xl bg-stone-800 px-4 py-4 font-semibold text-white disabled:opacity-30"
        >
          Intrare
        </button>
        {authError ? (
          <p className="mt-4 text-sm text-red-600">
            {authError.includes("PIN_GRESIT")
              ? "PIN greșit."
              : authError}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-stone-400">
          PIN-ul e generat automat la prima pornire a bazei de date. Il
          poti schimba din tab-ul Setari.
        </p>
      </main>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "orders", label: "Comenzi" },
    { id: "production", label: "Producție" },
    { id: "catalog", label: "Catalog" },
    { id: "settings", label: "Setări" },
  ];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Panou brutar</h1>
          <p className="text-sm text-stone-500">
            {data.pending.length - acceptedCount} în așteptare ·{" "}
            {acceptedCount} preluate · {deliveredToday} livrate azi
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold"
        >
          Ieșire
        </button>
      </header>

      {data.banner ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Banner vizibil clientilor: „{data.banner}”
        </div>
      ) : null}

      <nav className="mb-6 flex gap-1 rounded-2xl bg-stone-200/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold ${
              tab === t.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            msg === "Salvat."
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      ) : null}

      {tab === "orders" ? (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <input
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Caută după telefon..."
              type="tel"
              className={fieldClass}
            />
            <button
              onClick={search}
              className="shrink-0 rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Caută
            </button>
          </div>
          {searchResults ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <h3 className="mb-2 font-semibold">Rezultate</h3>
              {searchResults.length === 0 ? (
                <p className="text-sm text-stone-500">Niciun rezultat.</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((o) => (
                    <div
                      key={o.code}
                      className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-mono font-bold">{o.code}</span>{" "}
                        · {o.name} · {o.address}
                      </span>
                      <span
                        className={
                          o.delivered_at
                            ? "text-green-700"
                            : o.accepted_at
                              ? "text-sky-700"
                              : "text-amber-700"
                        }
                      >
                        {o.delivered_at
                          ? "Livrata"
                          : o.accepted_at
                            ? "Preluata"
                            : "In asteptare"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {grouped.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-10 text-center text-stone-500">
              Nicio comandă deschisă. 🎉
            </div>
          ) : (
            grouped.map(([street, orders]) => (
              <div key={street}>
                <h3 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  {street}{" "}
                  <span className="text-stone-400">
                    ({orders.length})
                  </span>
                </h3>
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div
                      key={o.code}
                      className="rounded-2xl border border-stone-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-900">
                            {o.name}{" "}
                            <span className="font-normal text-stone-400">
                              · {o.code}
                            </span>
                          </div>
                          <a
                            href={`tel:${o.phone}`}
                            className="text-sm text-amber-700 underline"
                          >
                            {o.phone}
                          </a>
                          <div className="mt-1 text-xs text-stone-500">
                            {formatDate(o.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-amber-700">
                            {formatLei(o.total)}
                          </div>
                          {o.accepted_at ? (
                            <div className="mt-2 text-xs font-semibold text-sky-700">
                              Preluata la {formatDate(o.accepted_at)}
                            </div>
                          ) : (
                            <button
                              onClick={() => markAccepted(o)}
                              disabled={busy}
                              className="mt-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              Preluata
                            </button>
                          )}
                          <button
                            onClick={() => markDelivered(o)}
                            disabled={busy}
                            className="mt-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Livrata
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
                        {o.items.map((it) => (
                          <div
                            key={it.bread_id}
                            className="flex justify-between"
                          >
                            <span>
                              {it.name} × {it.qty}
                            </span>
                            <span className="text-stone-500">
                              {formatLei(it.row_total)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {o.notes ? (
                        <div className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                          {o.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {data.delivered.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <h3 className="mb-2 font-semibold text-stone-700">
                Ultimele livrări
              </h3>
              <div className="space-y-1">
                {data.delivered.map((o) => (
                  <div
                    key={o.code}
                    className="flex justify-between text-sm text-stone-600"
                  >
                    <span>
                      <span className="font-mono font-bold">{o.code}</span> ·{" "}
                      {formatDate(o.delivered_at)}
                    </span>
                    <span>{formatLei(o.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "production" ? (
        <section>
          <div className="rounded-2xl bg-white p-5">
            <h3 className="font-semibold text-stone-900">
              De preparat acum{" "}
              <span className="text-stone-400">
                ({data.pending.length} comenzi · {formatLei(pendingTotal)})
              </span>
            </h3>
            <div className="mt-4 space-y-3">
              {data.breads
                .filter((b) => (data.production[b.name] ?? 0) > 0)
                .map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3"
                  >
                    <span className="font-semibold">{b.name}</span>
                    <span className="text-2xl font-bold text-amber-800">
                      {data.production[b.name]}
                      <span className="ml-1 text-sm font-normal text-stone-500">
                        buc.
                      </span>
                    </span>
                  </div>
                ))}
              {data.breads.every((b) => !(data.production[b.name] ?? 0)) ? (
                <p className="py-6 text-center text-stone-500">
                  Nimic de pregătit — nu există comenzi în așteptare.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "catalog" ? (
        <section className="space-y-4">
          <button
            onClick={() => startEdit("new")}
            className="w-full rounded-2xl border-2 border-dashed border-stone-300 px-4 py-4 font-semibold text-stone-600"
          >
            + Paine nouă
          </button>

          {data.breads.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl border bg-white p-4 ${
                b.active
                  ? "border-stone-200"
                  : "border-stone-200 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                {b.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photo_url}
                    alt={b.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-xl">
                    🍞
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-sm text-stone-500">
                    {formatLei(b.price)}
                    {b.weight_g > 0 ? ` · ${b.weight_g} g` : ""}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(b)}
                  disabled={busy}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    b.active
                      ? "bg-stone-100 text-stone-600"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {b.active ? "Oprita" : "Pornita"}
                </button>
                <button
                  onClick={() => startEdit(b)}
                  className="rounded-xl bg-stone-800 px-3 py-2 text-sm font-semibold text-white"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}

          {editing ? (
            <div className="rounded-2xl border-2 border-amber-300 bg-white p-4">
              <h3 className="mb-3 font-semibold">
                {editing === "new" ? "Paine nouă" : "Editează"}
              </h3>
              <div className="space-y-3">
                <input
                  className={fieldClass}
                  placeholder="Nume (ex: Paine cu maia)"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                />
                <textarea
                  className={fieldClass}
                  placeholder="Descriere (text)"
                  rows={2}
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                />
                <div className="flex gap-3">
                  <input
                    className={fieldClass}
                    placeholder="Greutate (g)"
                    type="number"
                    value={fWeight}
                    onChange={(e) => setFWeight(e.target.value)}
                  />
                  <input
                    className={fieldClass}
                    placeholder="Preț (lei)"
                    type="text"
                    inputMode="decimal"
                    value={fPrice}
                    onChange={(e) => setFPrice(e.target.value)}
                  />
                </div>
                <label className="block text-sm font-semibold">
                  Fotografie
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="mt-1 block w-full text-sm text-stone-600"
                  />
                  {editing !== "new" &&
                  (editing as Bread).photo_url ? (
                    <span className="mt-1 block font-normal text-stone-400">
                      Lasi campul gol pentru a pastra pozele existente.
                    </span>
                  ) : null}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={saveBread}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-stone-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    Salvează
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 rounded-xl border border-stone-300 px-4 py-3 font-semibold"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="space-y-5">
          <div className="rounded-2xl bg-white p-4">
            <label className="text-sm font-semibold">
              Mesaj informativ (apare la clienti)
              <textarea
                rows={3}
                className={fieldClass + " mt-2"}
                placeholder="ex: Livrare miercuri si sambata, dupa ora 10."
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
              />
            </label>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <label className="flex items-center justify-between">
              <span className="font-semibold">Comenzi deschise</span>
              <input
                type="checkbox"
                checked={orderingOpen}
                onChange={(e) => setOrderingOpen(e.target.checked)}
                className="h-6 w-6 accent-amber-600"
              />
            </label>
            <p className="mt-1 text-sm text-stone-500">
              Cand e dezactivat, clientii vad mesajul „Comenzile sunt inchise”.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <label className="text-sm font-semibold">
              Schimbă PIN (optional)
              <input
                type="password"
                inputMode="numeric"
                minLength={6}
                maxLength={12}
                className={fieldClass + " mt-2"}
                placeholder="Cel puțin 6 cifre"
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, ""))
                }
              />
            </label>
          </div>
          <button
            onClick={saveSettings}
            disabled={busy}
            className="w-full rounded-2xl bg-stone-800 px-4 py-4 font-semibold text-white disabled:opacity-50"
          >
            Salvează setările
          </button>
        </section>
      ) : null}
    </main>
  );
}
