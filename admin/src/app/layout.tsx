import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Google Sans (SIL OFL 1.1, see ../fonts/GoogleSans-OFL.txt): the same face as the Carma app.
const googleSans = localFont({
  variable: "--font-google-sans",
  src: [
    { path: "../fonts/GoogleSans_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/GoogleSans_500Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/GoogleSans_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/GoogleSans_700Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Carma Admin",
  description: "Internal ops dashboard and API backend for Carma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${googleSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
