// server/routes/accountRoutes.js
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// Use service-role key from .env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// DELETE /api/account/delete
router.delete("/delete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    // Verify the JWT and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    const { user_id } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required." });
    }

    // Only allow users to delete their own account
    if (user.id !== user_id) {
      return res.status(403).json({ error: "You can only delete your own account." });
    }

    // Delete the user from auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return res.status(500).json({ error: deleteError.message || "Failed to delete user." });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: err.message || "Internal server error." });
  }
});

module.exports = router;