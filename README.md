# JASync

**Sync your studies, tasks, and goals.**

JASync is a personal school planner: schedules, deadlines, subjects, notes, and study plans in one calm place. It is a static website (plain HTML, CSS and JavaScript, no build step) that uses Firebase for sign-in and cloud sync, and is published with GitHub Pages.

## Features
- **Dashboard:** open tasks, what's due this week, subjects and upcoming events at a glance
- **Calendar:** month, week and agenda views; events with start/end times, notes and colours; repeat daily, weekly, every other week, monthly or yearly; task deadlines can be shown on the calendar
- **Tasks:** per-subject task sheets with type, due date and time, priority, status and submission method; overdue tasks are flagged in the sidebar
- **My Subjects:** a notebook for each subject with rich-text lesson notes, pinned lessons and file attachments
- **Notes:** general notes you can pin and sort
- **Search** across the planner (Ctrl K), light/dark/system theme, accent colour, backup and restore to a JSON file
- Installable as an app (PWA) with offline caching

## Pages and files

| File | Purpose |
|---|---|
| `index.html`, `landing.css`, `landing.js` | Public landing page. Signed-in visitors are sent straight to the planner. |
| `login.html`, `login.js` | Sign in, create an account, reset a password. |
| `app.html`, `app.js`, `styles.css` | The planner itself. Only shown to signed-in users. |
| `firebase-config.js` | Firebase project settings; sets up Authentication (and Firestore on pages that load it). |
| `firestore.rules` | Firestore security rules to publish in the Firebase Console. |
| `sw.js`, `manifest.json` | Service worker (offline cache) and app manifest. |
| `logo.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | JASync logo, browser tab icon and home-screen icons. |

`shared.js`, `calendar.js`, `tasks.js` and `notes.js` are left over from an older multi-page version and are not loaded by any page.

## Sign-in flow
1. A signed-out visitor opening the site sees only the landing page.
2. **Get Started** opens the login page on *Create account*; **Sign In** opens it on *Log in*.
3. After signing in, the visitor is taken to the Dashboard (`app.html`).
4. Signed-in visitors who open the site go straight to the Dashboard. Firebase keeps the session across refreshes and browser restarts.
5. `app.html` stays hidden until Firebase confirms a signed-in user. Anyone signed out is sent back to the landing page. If they asked for a specific view (for example `app.html#tasks`), it is remembered and opened after login.
6. **Sign out** clears the planner from the page and returns to the landing page. The Back button cannot bring the Dashboard back.

## Firebase setup

### Authentication
In **Firebase Console → Authentication → Sign-in method**, enable:
- **Google**
- **Email/Password**

Add the GitHub Pages hostname under **Authentication → Settings → Authorized domains**. `localhost` is allowed by default for local testing.

### Firestore security rules
In **Firestore Database → Rules**, replace the rules with the contents of `firestore.rules` and click **Publish**. They let a signed-in user read and write only their own planner and deny everything else.

## Data storage
- Each account's planner is one Firestore document: `users/{USER_UID}/planner/main`. It holds the calendar, tasks, notes and settings, plus an `owner` field with the account's UID.
- A copy is also kept in the browser's local storage per account (`school-planner-v2:{USER_UID}`), so accounts that share a device never see each other's data.
- A new account always starts with a blank planner.
- File attachments in subject notebooks are stored only on the device where they were added (IndexedDB). They are not uploaded to the cloud.
- Planner data from before accounts had separate storage is only offered to the original owner account, set as `LEGACY_OWNER_EMAIL` in `app.js`.

## Running and deploying
- **Publish:** push to the `main` branch; GitHub Pages serves the repository root. Keep the files at the root, not in a subfolder.
- **Test locally:** use a local web server (for example `python -m http.server`) and open `http://localhost:8000/`. Opening the files directly as `file://` pages does not work with Firebase.
- **After changing files:** bump the `CACHE` name in `sw.js` so returning visitors get the new version. The service worker checks the server for the page, script and style files on every load, so updates appear on the next reload.
