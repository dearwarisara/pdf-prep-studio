# PDF Prep Studio

PDF Prep Studio is a single-screen, local-first web tool for preparing PDFs:

- removes document metadata from a generated PDF copy
- renders page 1 as a WebP cover under 500 KB
- checks page count, metadata, first-page rendering, and cover size before download
- keeps the source PDF unchanged and does not upload files

## Run locally

Because the app loads browser libraries from CDNs, serve `dist/` over HTTP:

```powershell
python -m http.server 4173 --directory dist
```

Then open <http://localhost:4173>.

## Deploy

The repository includes a GitHub Actions workflow that deploys `dist/` to GitHub Pages whenever `main` is updated. Enable GitHub Pages with **GitHub Actions** as the source in the repository settings if it is not already enabled.

## Privacy note

PDF processing happens in the browser. The original file is never overwritten; downloads are created as new files with `_metadata-removed.pdf` and `_page-1.webp` suffixes.
