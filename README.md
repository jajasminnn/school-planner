# JASync

*Your acads. All synced.*

JASync is a personal school planner: schedules, deadlines, subjects, notes, and study plans in one calm place. It is a static website (plain HTML, CSS and JavaScript, no build step) that uses Firebase for sign-in and cloud sync, and is published with GitHub Pages.

## Features
- **Dashboard:** open tasks, what's due this week, subjects and upcoming events at a glance
- **Calendar:** month, week and agenda views; events with start/end times, notes and colours; repeat daily, weekly, every other week, monthly or yearly; task deadlines can be shown on the calendar; export the calendar (and open task deadlines) as an `.ics` file for Google, Apple or Outlook calendar, or add a single event from its edit dialog
- **Tasks:** per-subject task sheets with type, date assigned, due date, deadline time, priority, status and submission method; overdue tasks are flagged in the sidebar. The **Deadline** column shows a compact time (e.g. 🕐 7:30 PM, or "Set time") that opens the clock time picker when clicked.
- **My Subjects:** a notebook for each subject with rich-text lesson notes, pinned lessons and file attachments
- **Notes:** general notes you can pin and sort
- **Saving notes:** lessons and notes autosave as you type. Each also has a **Save** button (or Ctrl/⌘ + S) that uploads right away and confirms with "✓ Saved", plus a **Close** button next to it at the bottom.
- **Pin and Delete:** small Pin (☆/★) and trash buttons sit beside the lesson or note title. Deleting always asks "Delete this lesson?" / "Delete this note?" first, and only deletes after you confirm.
- **Collapsible sidebar:** the sidebar folds into an icon-only rail with a toggle that stays visible in both states. Icons show their names on hover or keyboard focus, overdue tasks show as a dot on the Tasks icon, and the collapsed/expanded choice is remembered on each device.
- **Clock time picker:** event Start/End times and task deadline times are picked on a round clock. Tap the hour, then the minutes (numbers are 5-minute steps; tap between them for an exact minute), switch AM/PM, and press **Done**. You can also use the − / + buttons, type the digits (e.g. `6` `2` `3` for 6:23), or use the arrow keys. **Cancel** leaves the time unchanged and **Clear time** removes it. Times are still stored as `"HH:MM"` (24-hour).
- **Stay signed in:** you stay signed in on your browser for 30 days, so you don't have to sign in every time you open JASync (see [Sign-in flow](#sign-in-flow)).
- **Search** across the planner (Ctrl K), light/dark/system theme, accent colour, backup and restore to a JSON file
- Installable as an app (PWA) with offline caching

## Pages and files

| File | Purpose |
|---|---|
| `index.html`, `landing.css`, `landing.js` | Public landing page. Signed-in visitors are sent straight to the planner. |
| `login.html`, `login.js` | Sign in, create an account, reset a password. |
| `app.html`, `app.js`, `styles.css` | The planner itself. Only shown to signed-in users. |
| `firebase-config.js` | Firebase project settings; sets up Authentication (and Firestore on pages that load it). |
| `session.js` | Signs a user out 30 days after they signed in on that browser. |
| `firestore.rules` | Firestore security rules to publish in the Firebase Console. |
| `sw.js`, `manifest.json` | Service worker (offline cache) and app manifest. |
| `logo.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | JASync logo, browser tab icon and home-screen icons. |

`shared.js`, `calendar.js`, `tasks.js` and `notes.js` are left over from an older multi-page version and are not loaded by any page.

## Sign-in flow
1. A signed-out visitor opening the site sees only the landing page.
2. **Get Started** opens the login page on *Create account*; **Sign In** opens it on *Log in*.
3. After signing in, the visitor is taken to the Dashboard (`app.html`).
4. Signed-in visitors who open the site go straight to the Dashboard. They stay signed in on that browser across refreshes and restarts for **30 days** from when they signed in there. After that they are signed out and asked to sign in again (the login page explains why). Each browser or device has its own 30 days, and opening the app does not extend it; signing in again does.
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
- A few per-device settings live only in the browser's local storage: the sidebar's collapsed state (`jasync-sidebar-collapsed`), when the user signed in on this browser (`jasync-signin:{USER_UID}`), and the theme (`school-planner-theme`).

## Running and deploying
- **Publish:** push to the `main` branch; GitHub Pages serves the repository root. Keep the files at the root, not in a subfolder.
- **Test locally:** use a local web server (for example `python -m http.server`) and open `http://localhost:8000/`. Opening the files directly as `file://` pages does not work with Firebase.
- **After changing files:** bump the `CACHE` name in `sw.js` so returning visitors get the new version. The service worker checks the server for the page, script and style files on every load, so updates appear on the next reload.
