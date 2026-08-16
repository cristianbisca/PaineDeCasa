"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submit = () => {
    const c = code.replace(/\s/g, "").toUpperCase();
    if (c.length === 6) router.push(`/o/${c}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-stone-900">Statusul comenzii</h1>
      <p className="mt-2 text-stone-600">
        Introdu codul de 6 caractere primit dupa plasarea comenzii.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect="off"
        className="mt-8 w-full rounded-2xl border-2 border-stone-300 bg-white px-4 py-4 text-center font-mono text-3xl font-bold uppercase tracking-[0.35em] focus:border-amber-500 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={code.length !== 6}
        className="mt-6 w-full rounded-2xl bg-stone-800 px-4 py-4 text-lg font-semibold text-white disabled:opacity-30"
      >
        Verifică statusul
      </button>
    </main>
  );
}
