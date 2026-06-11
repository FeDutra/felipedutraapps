const admin = require("firebase-admin");

try {
  admin.initializeApp({
    projectId: "felipedutraapps"
  });
  const db = admin.firestore();
  
  console.log("Checking connection...");
  db.collection("workspaces/felipe_dutra/pulso_areas").limit(1).get()
    .then(snap => {
      console.log(`✅ Success! Fetched ${snap.size} documents.`);
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Permission/Auth Error:", err.message);
      process.exit(1);
    });
} catch (err) {
  console.error("🔥 Error initializing firebase-admin:", err);
  process.exit(1);
}
