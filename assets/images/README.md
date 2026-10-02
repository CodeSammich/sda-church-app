# Bundled image assets

Images imported by the application live under this directory:

- `brand/` — unmodified third-party provider assets and their usage notes.
- `hymnals/` — local hymnbook cover artwork, using kebab-case filenames.
- `library/` — curated library cover artwork, including the `egw/` collection.

`youtube_art.png` and `spotify_podcast_art.png`, at this directory's root, aren't
imported anywhere.

The app imports these files through Metro, so the paths work in native builds and
the web bundle without also copying them as public static files. The icon files at
the `public/` root are intentionally kept there because the PWA manifest and HTML
use stable web-root URLs for them. The HTML links include the configured
`/sda-church-app/` base path so they continue to work on nested GitHub Pages routes.
Web-only files such as `manifest.json`, `sw.js`, `robots.txt`, and the
`privacy-policy.html`, `support.html`, and `download.html` pages also remain at the
`public/` root, and `public/library/` holds the Sabbath Encouragement PDF.
