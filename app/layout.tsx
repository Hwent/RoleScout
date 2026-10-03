import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoleScout | Explore jobs",
  description: "Search job listings and explore real job descriptions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
