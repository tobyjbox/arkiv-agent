import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "ArkivAgent", description: "Projects and datasets on Arkiv" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
