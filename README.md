# Ball Bearing Selection Tool

A static website for selecting SKF and FAG ball bearings (deep groove, angular contact, self-aligning) from catalogue data.

## Files
- `index.html` – the website
- `assets/css/style.css` – design (steel · copper · charcoal · amber, dark/light mode)
- `assets/js/data.js` – catalogue (1,200 SKF/FAG part numbers; D, B, C, C0, speeds are ESTIMATED – replace with official values)
- `assets/js/app.js` – calculations, selector, catalogue browser, lab calculators, chart

## Run locally
Double-click `index.html`.

## Put online (free)
**Netlify Drop:** go to https://app.netlify.com/drop and drag this whole folder onto the page.

**GitHub Pages:** create a repository, upload all files (keep the folder structure), then Settings → Pages → Branch: main → / (root) → Save.

## Updating catalogue values
Open `assets/js/data.js` and edit `D`, `B`, `C` (kN), `C0` (kN), `nG` (grease speed, rpm) and `nO` (oil speed, rpm) for any part number.
