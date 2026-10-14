require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const universityRoutes = require("./routes/universityRoutes");
const aiRoutes = require("./routes/aiRoutes");
const accountRoutes = require("./routes/accountRoutes");

const { applySecurity } = require("./security/server-headers");

const app = express();

// Initialize security after creating the app,
// but before static files and application routes.
applySecurity(app);

app.use(cors());
app.use(express.json());

// Project root directory
const rootPath = path.resolve(__dirname, "..");

// Serve static assets
app.use(express.static(rootPath));

// API routes
app.use("/universities", universityRoutes);
app.use("/ai", aiRoutes);
app.use("/api/account", accountRoutes);

// Home route
app.get("/", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(404).send("index.html not found.");
});

// University profile route
app.get("/university/:slug", (req, res) => {
  const profilePath = path.join(rootPath, "profile.html");

  if (fs.existsSync(profilePath)) {
    return res.sendFile(profilePath);
  }

  return res.sendFile(path.join(rootPath, "index.html"));
});

// Catch-all route for SPA navigation
app.get("/{*splat}", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(404).json({ error: "Files not found" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});