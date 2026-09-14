# Bundled image assets

Images imported by the application live under this directory:

- `brand/` — unmodified third-party provider assets and their usage notes.
- `hymnals/` — local hymnbook cover artwork, using kebab-case filenames.
- `library/` — curated library cover artwork, including the `egw/` collection.

The app imports these files through Metro, so the paths work in native builds and
the web bundle without also copying them as public static files. The icon files at
the `public/` root are intentionally kept there because the PWA manifest and HTML
use stable web-root URLs for them. The HTML links include the configured
`/sda-church-app/` base path so they continue to work on nested GitHub Pages routes.
Web-only files such as `manifest.json`, `sw.js`, and `privacy-policy.html` also
remain at the `public/` root.
