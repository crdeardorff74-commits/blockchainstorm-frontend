# TANTЯO Front-End — Claude Instructions

Universal rules live in `../../CLAUDE.md`. Read those first.

## Session notes
Read `NOTES.md` (in this folder) at the start of every session. It's the running log of decisions, next steps, and project-specific gotchas that aren't visible in the code. Updated automatically by `/release` and `/rel`, and manually by `/note`.

## Version Bumping
The universal `/release` and `/rel` commands bump both versions together and update `NOTES.md`. They do **not** zip — you run the zip yourself (see below; Claude never zips because the antivirus flags it). Manual notes:
- `APP_VERSION` in `sw.js` and `PAGE_VERSION` in `index.html` MUST match (mismatch causes an infinite refresh loop).
- `game.js` reads `PAGE_VERSION` at runtime, so it stays in sync automatically.

## Deployment Zip
The zip is named `TANTЯO.zip` (note the Cyrillic Я — preserved exactly as `PROJECT_NAME` in `config.js`). Excluded from the zip: `CLAUDE.md`, `NOTES.md`, the zip itself, and `nul`. Sub-folders (`Music/`, `Sounds/`) are NOT zipped — those assets are served from the shared music host (`music.official-intelligence.art`, the `oi-music/` Netlify site).

You run the zip yourself in PowerShell when ready. Building the `Я` via `[char]0x042F`
keeps the Cyrillic name exact regardless of console encoding:

```powershell
$d = 'C:\Users\Ryan\Personal\Official Intelligence\tantro\tantro-front-end'
$z = "TANT$([char]0x042F)O.zip"
$p = Join-Path $d $z
if (Test-Path $p) { Remove-Item $p }
$f = Get-ChildItem $d -File | Where-Object { @('CLAUDE.md','NOTES.md','nul',$z) -notcontains $_.Name }
Compress-Archive -Path $f.FullName -DestinationPath $p
Write-Host "Zipped $($f.Count) files into $z"
```
