// Firebase configuration for School Planner Web.
// This client-side config is intended for the browser.

const schoolPlannerFirebaseConfig = {
  apiKey: "AIzaSyCxTGdleY1NHKvxoQbAjIG7O6WPNSAL7LU",
  authDomain: "school-planner-65a5c.firebaseapp.com",
  projectId: "school-planner-65a5c",
  storageBucket: "school-planner-65a5c.firebasestorage.app",
  messagingSenderId: "971462811649",
  appId: "1:971462811649:web:c85dce55b2a11a57296000",
  measurementId: "G-DLKY6ZXG2B"
};

if (!firebase.apps.length) {
  firebase.initializeApp(schoolPlannerFirebaseConfig);
}

window.schoolPlannerFirebase = {
  auth: firebase.auth(),
  db: firebase.firestore()
};