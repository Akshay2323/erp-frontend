import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import { AccentThemeProvider } from "@/components/accent-theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ACCENT_BOOTSTRAP_SCRIPT, DEFAULT_ACCENT_ID, getAccentTheme } from "@/lib/accent-theme";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const defaultAccent = getAccentTheme(DEFAULT_ACCENT_ID);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: defaultAccent.swatch,
};

export const metadata: Metadata = {
  title: {
    default: "Jwork",
    template: "%s | Jwork",
  },
  description: "jwork — workforce, attendance, leave, and payroll management.",
  manifest: "/manifest.json",
  robots: isProdEnv() ? { index: false, follow: false } : undefined,
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jwork",
  },
};

function isProdEnv() {
  return process.env.NODE_ENV === "production";
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: ACCENT_BOOTSTRAP_SCRIPT }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <AccentThemeProvider>
            <QueryProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </QueryProvider>
          </AccentThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
