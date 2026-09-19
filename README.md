# School Planner

One website with a **left panel** to switch between:

- **🗓️ Calendar**: month, week and agenda views, repeating events, search, task deadlines, and 12 colors plus a custom color picker.
- **✅ Tasks**: a task tracker. You type in your own subjects (none are pre-filled).
- **📝 Notes**: create folders in the left panel and keep notes inside them.

It is only HTML, CSS and JavaScript, so it can be hosted free on **GitHub Pages**. There is no server.

It works in two ways:

| | **Local mode** (default) | **Cloud mode** (optional) |
|---|---|---|
| Login | none | email + password |
| Where data is saved | in the browser you use | in your free Firebase database |
| Same data on other devices | no (use **Backup / Restore**) | yes, just log in |
| Setup | none | about 10 minutes (steps below) |

---

## Part 1: Publish on GitHub Pages

1. Make a free account at https://github.com and click **New repository**. Name it e.g. `school-planner`, keep it **Public**, and create it.
2. Click **uploading an existing file** and drag in **all the files from this folder** (`index.html`, `styles.css`, the `.js` files, `login.html`, ...). They must be at the top level, not inside another folder. Click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/ (root)**, then **Save**.
4. After a minute or two your site is at `https://YOUR-USERNAME.github.io/school-planner/`.

In local mode you can start using it right away. To move your data to another device, click **Backup** in the left panel, then **Restore** on the other device.

---

## Part 2 (optional): Login and cloud saving with Firebase

Firebase is a free Google service (the free "Spark" plan is plenty).

1. Go to https://console.firebase.google.com, click **Add project**, and finish the wizard.
2. **Turn on login:** **Build → Authentication → Get started → Sign-in method → Email/Password**, switch it on, save.
3. **Create the database:** **Build → Firestore Database → Create database**, pick a location, choose **Production mode**.
4. **Add the security rules** (this keeps each person's data private): in Firestore open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. **Allow your website address:** **Authentication → Settings → Authorized domains → Add domain** and add `YOUR-USERNAME.github.io`.
6. **Get your config:** the gear icon → **Project settings**. Under **Your apps** click the **`</>` (Web)** button, register an app, and copy the `firebaseConfig` values.
7. In your GitHub repository open `firebase-config.js` (pencil icon), replace `window.FIREBASE_CONFIG = null;` with:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "PASTE-HERE",
     authDomain: "PASTE-HERE",
     projectId: "PASTE-HERE",
     appId: "PASTE-HERE"
   };
   ```
   and click **Commit changes**. After a minute the site asks people to log in or create an account.

The `apiKey` is not a secret. The rules in step 4 are what protect each person's data.

Notes for cloud mode:
- "Forgot password?" sends a reset email automatically.
- Anyone who opens your site can create an account, but each account only sees its own data.
- Each of Calendar, Tasks and Notes is saved as one Firestore document (limit about 1 MB each). Notes is the one most likely to grow: if it gets too big the left panel shows "Too much data to save".
- Data saved earlier in local mode stays in that browser. Use **Backup** first, or the **Import** buttons on the Calendar and Tasks pages, to bring it across.

---

## Files

```
index.html          the website: left panel + Calendar, Tasks and Notes
styles.css          all styles
shared.js           saving, login, dialogs
app.js              left panel and page switching
calendar.js         calendar
tasks.js            task tracker
notes.js            notes and folders
login.html          login / create account (only used in cloud mode)
firebase-config.js  paste your Firebase config here (optional)
firestore.rules     security rules to paste into Firebase
```

## Try it on your own computer

Open a terminal in this folder and run `python3 -m http.server 8000`, then visit http://localhost:8000.
(Double-clicking `index.html` may not work with login, because browsers restrict `file://` pages.)
