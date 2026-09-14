import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "OpenGEA · OAuth Chat",
  description: "Sign in with GEA and chat with your authorized Agent.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
