/*
 * OPTIONAL: turn on login + cloud saving.
 *
 * Leave this as null and the planner works right away, saving on the device you use (no login).
 * To let people log in and keep their data on any device, create a free Firebase project
 * (steps are in README.md) and paste its web app config here, like this:
 *
 * window.FIREBASE_CONFIG = {
 *   apiKey: "AIza...",
 *   authDomain: "your-project.firebaseapp.com",
 *   projectId: "your-project",
 *   appId: "1:1234567890:web:abcdef"
 * };
 */
window.FIREBASE_CONFIG = null;
