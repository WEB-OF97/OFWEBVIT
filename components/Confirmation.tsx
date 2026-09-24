"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";

export function Confirmation({ id }: { id: string }) {
  const [summary, setSummary] = useState<OrderSummary | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`of-order-${id}`);
    if (!raw) return;
    try {
      setSummary(JSON.parse(raw) as OrderSummary);
    } catch {
      setSummary(null);
    }
  }, [id]);

  const demo = id.startsWith("demo-") || summary?.demo;

  return (
    <div className="confirm">
      <h1>Commande enregistrée</h1>
      <p>
        Numéro <strong>{id}</strong>
      </p>
      {summary && summary.total_ttc != null ? (
        <p>
          Total TTC <strong>{formatMoney(summary.total_ttc)}</strong>
          {summary.total_ht != null ? ` · HT ${formatMoney(summary.total_ht)}` : null}
        </p>
      ) : (
        <p>Le montant vous sera confirmé si un article est sur devis.</p>
      )}
      {demo ? (
        <p className="banner">
          Mode démonstration : Supabase n&apos;est pas configuré, la commande n&apos;a pas été enregistrée.
        </p>
      ) : (
        <p>Nous avons reçu votre commande et vous recontactons pour la suite.</p>
      )}
      <Link href="/" className="btn">
        Retour au catalogue
      </Link>
    </div>
  );
}
