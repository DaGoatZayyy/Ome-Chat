import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmeChat — Meet someone new",
  description: "A simple place to meet new people through text or video chat.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
