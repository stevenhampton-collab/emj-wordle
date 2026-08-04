import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMJ Wordle",
  description: "The weekly word game for the Every Man Jack team.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <span className="brand">
              <span className="logo-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/emj-logo.svg" alt="Every Man Jack" width={30} height={30} />
              </span>
              EMJ Wordle
            </span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
