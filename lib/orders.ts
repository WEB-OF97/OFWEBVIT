import { getProductsByCodpro } from "./catalog";
import { effectivePrices, roundMoney } from "./pricing";
import { createAnonServerSupabase } from "./supabase";

export type OrderLineInput = { codpro: string; qty: number };

export type PlaceOrderInput = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  items: OrderLineInput[];
};

export type PlaceOrderResult = {
  id: string;
  demo: boolean;
  total_ht: number | null;
  total_ttc: number | null;
  lines: number;
};

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function address(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  if (!raw || typeof raw !== "object") throw new Error("Formulaire incomplet.");
  const body = raw as Record<string, unknown>;
  const customer_name = text(body.customer_name, 120);
  const customer_email = text(body.customer_email, 160).toLowerCase();
  const customer_phone = text(body.customer_phone, 30);
  const shipping_address = address(body.shipping_address, 500);

  if (customer_name.length < 2) throw new Error("Indiquez votre nom.");
  if (!emailOk(customer_email)) throw new Error("Indiquez un email valide.");
  if (customer_phone.length < 6) throw new Error("Indiquez un téléphone.");
  if (shipping_address.length < 5) throw new Error("Indiquez une adresse de livraison.");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new Error("Le panier est vide.");
  }

  const requested: OrderLineInput[] = [];
  for (const item of body.items) {
    if (!item || typeof item !== "object") throw new Error("Article invalide.");
    const row = item as Record<string, unknown>;
    const codpro = text(row.codpro, 40);
    const qty = Number(row.qty);
    if (!/^[A-Za-z0-9._-]+$/.test(codpro)) throw new Error("Référence invalide.");
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) throw new Error("Quantité invalide.");
    requested.push({ codpro, qty });
  }

  const products = await getProductsByCodpro(requested.map((item) => item.codpro));
  const byId = new Map(products.map((product) => [product.codpro, product]));

  const items = requested.map((item) => {
    const product = byId.get(item.codpro);
    if (!product) throw new Error(`Produit introuvable : ${item.codpro}`);
    if (product.stock <= 0) throw new Error(`${product.name} est épuisé.`);
    const prices = effectivePrices(product);
    return {
      codpro: product.codpro,
      name: product.name,
      qty: item.qty,
      price_ht: prices.ht,
      price_ttc: prices.ttc,
    };
  });

  const unpriced = items.some((item) => item.price_ht == null || item.price_ttc == null);
  const total_ht = unpriced ? null : roundMoney(items.reduce((sum, item) => sum + (item.price_ht ?? 0) * item.qty, 0));
  const total_ttc = unpriced ? null : roundMoney(items.reduce((sum, item) => sum + (item.price_ttc ?? 0) * item.qty, 0));

  const sb = createAnonServerSupabase();
  if (!sb) {
    return { id: `demo-${crypto.randomUUID()}`, demo: true, total_ht, total_ttc, lines: items.length };
  }

  const id = crypto.randomUUID();
  const { error } = await sb.from("orders").insert({
    id,
    status: "nouvelle",
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    items,
    total_ht,
    total_ttc,
    exported: false,
  });
  if (error) throw new Error("La commande n'a pas pu être enregistrée.");
  return { id, demo: false, total_ht, total_ttc, lines: items.length };
}
