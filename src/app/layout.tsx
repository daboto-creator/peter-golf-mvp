import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";

import { serverEnv } from "@/env/server";
import { publicEnv } from "@/env/public";
import { BRAND_DESCRIPTION, BRAND_LOGOS, BRAND_NAME } from "@/lib/brand";

import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: [
      {
        url: BRAND_LOGOS.onLight,
        width: 1254,
        height: 1254,
        alt: BRAND_NAME,
      },
    ],
  },
  robots:
    serverEnv.APP_ENV === "production"
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: publicEnv.NEXT_PUBLIC_APP_URL,
    logo: new URL(
      BRAND_LOGOS.onLight,
      publicEnv.NEXT_PUBLIC_APP_URL,
    ).toString(),
  };

  return (
    <html
      lang="es-MX"
      className={`${montserrat.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
