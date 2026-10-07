import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { applyLocaleSettings, getCompany } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany();
  return {
    title: company.name,
    description: "HR, timekeeping and payroll for BPO operations",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await applyLocaleSettings();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
