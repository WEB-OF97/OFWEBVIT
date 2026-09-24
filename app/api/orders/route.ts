import { placeOrder } from "@/lib/orders";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Formulaire incomplet." }, { status: 400 });
  }
  try {
    const result = await placeOrder(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commande impossible.";
    const status = message.includes("enregistrée") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
