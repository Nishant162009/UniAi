require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const universityRoutes = require("./routes/universityRoutes");
const aiRoutes = require("./routes/aiRoutes");
const accountRoutes = require("./routes/accountRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Points directly to the project root directory
const rootPath = path.resolve(__dirname, "..");

// Serve static assets directly from root
app.use(express.static(rootPath));

// APIs
app.use("/universities", universityRoutes);
app.use("/ai", aiRoutes);
app.use("/api/account", accountRoutes);

// Home route
app.get("/", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found.");
  }
});

// Profile route
app.get("/university/:slug", (req, res) => {
  const profilePath = path.join(rootPath, "profile.html");
  if (fs.existsSync(profilePath)) {
    res.sendFile(profilePath);
  } else {
    res.sendFile(path.join(rootPath, "index.html"));
  }
});

// Catch-all route for SPA navigation
app.get("/{*splat}", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: "Files not found" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});