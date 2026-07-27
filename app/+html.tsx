import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />

        {/* Prevent search engines from indexing the site */}
        <meta name="robots" content="noindex, nofollow" />

        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* PWA Meta Tags */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta
          name="theme-color"
          content="#000000"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black"
        />
        <meta name="apple-mobile-web-app-title" content="NYCCSDA" />
        <link rel="apple-touch-icon" href="icon-192x192.png" />
        <link rel="manifest" href="manifest.json" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body style={{ backgroundColor: 'transparent' }}>{children}</body>
    </html>
  );
}

const globalStyles = `
:root { 
  --app-bg: ${customLightTheme.colors.background}; 
}
@media (prefers-color-scheme: dark) { 
  :root { --app-bg: ${customDarkTheme.colors.background}; } 
}

/* Base Styles */
html {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--app-bg) !important; /* Force the 'under-layer' color */
}

body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background-color: var(--app-bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
`;
