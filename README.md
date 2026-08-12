# Face Crop Studio

Privacy-first, client-side batch image cropping for ID cards and profile photos.

## Features

- Upload JPG, PNG, or WEBP (single or batch)
- Crop shapes: circle, square, rounded, heart, star, hexagon, curved hex, custom SVG
- Face / shoulders / eyes / nose centering (browser Shape Detection when available; otherwise manual)
- Live preview with pan, zoom, and rotation
- Adjustments: border, contrast, brightness, saturation, vignette + presets
- Apply settings to selected images; per-image overrides
- Async batch crop with progress
- Export PNG / JPG / WEBP, transparent PNG, ZIP download
- Original or postfix file naming
- Light / dark theme

**Images never leave your browser.** There is no backend upload or face identification.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Canvas rendering pipeline (shared preview/export)
- JSZip for archives

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Tests

With the dev server running (`npm run dev`):

```bash
npm run test:e2e      # upload → apply → crop → validate
npm run test:batch    # 50-image batch stress test
```

## Privacy

Face detection (when supported by the browser) only returns approximate bounding boxes for crop placement. No identity matching, no cloud AI, no persistent storage of uploads.
