import "./globals.css";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
export const metadata = {
  title: "Tech News · OpenGEA",
  description: "Discover Hacker News stories with a GEA Agent.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
