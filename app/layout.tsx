import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC Positioning Cockpit",
  description: "BTC 4H crowd positioning, leverage, funding and liquidation research cockpit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
