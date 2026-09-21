// Firebase configuration for School Planner Web.
// This client-side config is intended for the browser. Firestore Security Rules
// and Firebase Authentication protect the stored planner data.
const schoolPlannerFirebaseConfig = {
  apiKey: "AIzaSyCxTGdeY1NHKvxO0bAiIG7O6WPNSAL7LU",
  authDomain: "school-planner-65a5c.firebaseapp.com",
  projectId: "school-planner-65a5c",
  storageBucket: "school-planner-65a5c.firebasestorage.app",
  messagingSenderId: "971462811649",
  appId: "1:971462811649:web:f6b318ba2cb26307296000",
  measurementId: "G-GLWP5847KM"
};

if (!firebase.apps.length) firebase.initializeApp(schoolPlannerFirebaseConfig);
window.schoolPlannerFirebase = {
  auth: firebase.auth(),
  db: firebase.firestore()
};
