# School Planner — Modern Edition

This is a fresh rebuild based on the original School Planner idea. It keeps the core concepts—calendar, task tracker, subject folders/notebooks, notes, themes, local saving and backups—but uses a simpler modern UI.

## Included
- Dashboard with upcoming deadlines, events and subject overview
- Calendar with month + agenda views
- Clean responsive task cards
- Eight subject spaces with individual lesson notebooks
- General notes area
- Desktop collapsible sidebar and mobile slide-out sidebar
- Light/dark mode
- Local autosave + JSON backup/restore
- PWA install support

## Run locally
Use VS Code Live Server or run `python -m http.server 8000` in this folder.

## Cloud later
Firebase is intentionally not connected in this first rebuild. Once the UI and workflows are finalized, cloud sync/authentication can be added without changing the overall user experience.

## Data
The app stores data in localStorage under `school-planner-v2`. The first load attempts to import data from the original planner's keys when available in the same browser origin.
