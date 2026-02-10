import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "../components/sidebar";
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
  metadataBase: new URL("https://hwinfo-dashboard.vercel.app"),
  title: {
    template: "%s | HWinfo Dashboard",
    default: "HWinfo Dashboard",
  },
  description:
    "Hardware monitoring and system information dashboard. Track CPU, GPU, memory, and other system metrics with an intuitive interface.",
  keywords: [
    "hwinfo",
    "hardware monitoring",
    "system information",
    "CPU monitoring",
    "GPU monitoring",
    "dashboard",
    "real-time",
  ],
  authors: [{ name: "Temp" }],
  applicationName: "HWinfo Dashboard",
  generator: "Next.js",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
    },
  },
  openGraph: {
    title: "HWinfo Dashboard",
    description:
      "Real-time hardware monitoring and system information dashboard",
    url: "https://hwinfo-dashboard.vercel.app",
    siteName: "HWinfo Dashboard",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HWinfo Dashboard",
    description:
      "Real-time hardware monitoring and system information dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Sidebar>{children}</Sidebar>
        </ThemeProvider>
      </body>
    </html>
  );
}
