import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/next/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Preoperacional Seguridad Vial — ESS LTDA",
  description:
    "Inspecciones preoperacionales diarias de motocicletas para motorizados de seguridad vial de ESS LTDA.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-512.svg",
  },
};

// NOTE: themeColor below (#0B3B60) is a provisional corporate-blue
// placeholder, not ESS LTDA's confirmed brand color — see public/manifest.json.
export const viewport: Viewport = {
  themeColor: "#0B3B60",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* public/sw.js only exists after `serwist build` (part of `npm run
        build`), so registration is skipped outside production to avoid a
        404 during `next dev`. */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
