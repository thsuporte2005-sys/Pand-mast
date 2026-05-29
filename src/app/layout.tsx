import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pand mast - Painel de Controle",
  description: "Gerenciador privado de aplicativos e treinamentos internos.",
  icons: {
    icon: "/pngs/loggo.png",
  }
};

export const viewport: Viewport = {
  themeColor: "#071A2F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-primary-bg text-text-white flex flex-col">{children}</body>
    </html>
  );
}
