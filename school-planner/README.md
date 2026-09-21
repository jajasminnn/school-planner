# School Planner — Modern V2 + Firebase Cloud Sync

This version is based directly on **School Planner Modern V2 Calendar Fixed**. The existing planner UI and features are preserved while adding Firebase Authentication and Cloud Firestore sync.

## Existing planner features preserved
- Dashboard
- Calendar: Month, Week and Agenda views
- Add/edit/delete calendar events
- Recurring events, including Every other week (14 days)
- Event colors, start/end times and notes
- Task deadlines shown on the calendar
- Task tracker with subject sheets
- Eight subject spaces with lesson notebooks
- General notes
- Search
- Collapsible desktop sidebar + mobile sidebar
- Light/dark/system theme
- Backup/restore
- Local autosave
- PWA support

## Firebase connection
The browser loads the Firebase Web SDK and initializes it from `firebase-config.js`.

Firebase Authentication uses Google Sign-In. After the user signs in, the planner loads or creates this Firestore document:

`users/{USER_UID}/planner/main`

The document contains the planner's calendar, tasks, notes and settings as one synchronized data set.

## IMPORTANT: Firestore Security Rules

The file `firestore.rules` contains the intended rules. In Firebase Console, open:

**Firestore Database → Rules**

Replace the rules there with the contents of `firestore.rules`, then click **Publish**.

These rules allow an authenticated user to read/write only their own planner document and deny other access.

## Google Sign-In

Google Sign-In must be enabled under:

**Firebase Console → Authentication → Sign-in method → Google**

When the website is published on GitHub Pages, add the GitHub Pages hostname under Firebase Authentication's **Authorized domains** if Firebase asks you to do so.

## GitHub Pages

Upload the website files directly to the repository root. Do not put the files inside another folder if the repository is being used as the Pages root.

The Firebase CDN scripts require an internet connection, so the first cloud-sync test should be done from the published HTTPS website (or another local web server), not by double-clicking `index.html` as a `file://` page.

## Data behavior

- Before Google Sign-In, the planner continues to work with local browser storage.
- After Google Sign-In, Firestore becomes the cloud copy for that Google account.
- If that account has no cloud planner yet, the current local planner data is uploaded as its first cloud copy.
- Existing cloud data is loaded back into the planner when that account signs in.
- Local storage remains as a fallback/backup on the device.
