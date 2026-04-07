import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "MARS // COMMAND",
  description: "Autonomous agent control interface",
};

function NavSidebar() {
  const navItems = [
    { href: "/", label: "DASHBOARD", code: "SYS.01", color: "bg-neon-cyan" },
    { href: "/fleet", label: "FLEET", code: "SYS.02", color: "bg-neon-purple" },
    { href: "/provision", label: "PROVISION", code: "SYS.03", color: "bg-neon-amber" },
    { href: "/workflows", label: "WORKFLOWS", code: "SYS.04", color: "bg-neon-green" },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full w-56 border-r border-neon-cyan/10 bg-void flex flex-col z-50">
      {/* Scan line effect */}
      <div className="scan-line" />

      {/* Header */}
      <div className="px-5 pt-8 pb-6 border-b border-neon-cyan/10">
        <p className="text-[10px] uppercase tracking-[0.5em] text-neon-cyan/40 font-mono">
          sys://control
        </p>
        <h1
          className="text-lg font-bold text-neon-cyan tracking-wider mt-1 glitch-text font-mono"
          data-text="MARS"
        >
          MARS
        </h1>
        <p className="text-[10px] text-white/20 font-mono mt-0.5">
          v2.1.0 // ACTIVE
        </p>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 px-3 py-4 text-xs font-mono">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative rounded px-3 py-2.5 text-white/40 transition-all hover:bg-neon-cyan/5 hover:text-neon-cyan flex items-center gap-3"
          >
            <span className={`h-1.5 w-1.5 ${item.color} opacity-60 group-hover:opacity-100`} />
            <span className="flex-1 tracking-wider">{item.label}</span>
            <span className="text-[9px] text-white/15 group-hover:text-neon-cyan/30">
              {item.code}
            </span>
          </Link>
        ))}
      </div>

      {/* Separator */}
      <div className="mx-5 border-t border-white/5" />

      {/* Bottom status */}
      <div className="mt-auto px-5 py-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan status-pulse" />
          <span className="text-[10px] text-neon-cyan/50 font-mono tracking-wider">
            ONLINE
          </span>
        </div>
        <p className="text-[10px] text-white/15 font-mono">
          30 NODES // ACTIVE
        </p>
        <div className="h-px bg-gradient-to-r from-neon-cyan/20 to-transparent" />
        <p className="text-[9px] text-white/10 font-mono">
          {`{ AUTH: ADMIN }`}
        </p>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} font-mono bg-void text-white antialiased`}>
        <NavSidebar />
        <div className="ml-56 dystopia-grid min-h-screen">{children}</div>
      </body>
    </html>
  );
}
