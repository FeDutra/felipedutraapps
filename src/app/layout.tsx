import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ÉDEN Central",
  description: "Seu ecossistema pessoal de aplicativos.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('pulso-theme')==='black'){document.documentElement.classList.add('pulso-theme-black-preload')}}catch(e){}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var physicalPath = '/pulso/live/index.html';
                if (window.location.protocol !== 'tauri:' || window.location.pathname !== physicalPath) return;
                var preservePhysicalEntry = function(method) {
                  var original = window.history[method].bind(window.history);
                  window.history[method] = function(state, title, url) {
                    if (url != null) {
                      var target = new URL(String(url), window.location.href);
                      if (target.origin === window.location.origin && (target.pathname === '/pulso/live' || target.pathname === '/pulso/live/')) {
                        target.pathname = physicalPath;
                        url = target.href;
                      }
                    }
                    return original(state, title, url);
                  };
                };
                preservePhysicalEntry('pushState');
                preservePhysicalEntry('replaceState');
              } catch (_) {}
            })();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased h-full bg-[#020617] text-slate-50">
        {children}
      </body>
    </html>
  );
}
