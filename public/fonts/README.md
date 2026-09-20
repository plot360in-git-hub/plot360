# Archivo font files for the visit report PDF

`lib/pdf/visitReportPdf.ts` looks in this folder for two specific files
so it can embed the app's real Archivo font instead of falling back to
Helvetica:

- `Archivo-Regular.ttf`
- `Archivo-ExtraBold.ttf`

**This sandbox has no network access to Google Fonts** (every external
host it tried — fonts.googleapis.com, fonts.gstatic.com, GitHub's raw
content, the npm and PyPI registries — was blocked), so these two files
could not be fetched or committed here. You'll need to add them
yourself, once, from your own machine:

1. Go to <https://fonts.google.com/specimen/Archivo> and click
   **Download family** (top right) — this downloads a `.zip` of the
   whole family.
2. Unzip it and open the `static` folder inside.
3. Copy exactly these two files into this folder
   (`plot360/public/fonts/`), keeping their names as-is:
   - `Archivo-Regular.ttf`
   - `Archivo-ExtraBold.ttf`
4. Run `npm install` once (this adds `@pdf-lib/fontkit`, the new
   dependency that lets pdf-lib embed a custom font — already added to
   `package.json`).

That's it — no code change needed after that. `buildVisitReportPdf`
checks for both files at request time; if they're both there it embeds
Archivo (Regular for body text, ExtraBold for headings — the same two
roles Helvetica/HelveticaBold played before, and the same weight the
web app uses for `.p360` headings), and if either is missing it quietly
keeps using Helvetica, exactly as it does today. So nothing breaks
either way — dropping the files in is the only step.
