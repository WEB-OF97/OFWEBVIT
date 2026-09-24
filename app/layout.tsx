import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Office Fournitures", template: "%s · Office Fournitures" },
  description: "Fournitures et mobilier de bureau à Saint-Martin. Catalogue, prix TTC et commande en ligne.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={manrope.className}>
        <CartProvider>
          <Suspense fallback={<div className="header-fallback" />}>
            <Header />
          </Suspense>
          <main>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
