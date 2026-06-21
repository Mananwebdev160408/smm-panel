import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "NextWave // SMM Terminal",
  description: "Advanced Multi-Order SMM Control Center",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NextWave SMM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-cyber-bg text-slate-200 selection:bg-cyber-purple selection:text-black font-sans transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
          <AuthProvider>
          {children}
          <Toaster 
            position="top-right" 
            toastOptions={{
              className: '!bg-cyber-card !text-white !border !border-cyber-border',
              style: {
                background: '#0a0a0f',
                color: '#fff',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              },
            }} 
          />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
