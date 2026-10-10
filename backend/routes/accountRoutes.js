// server/routes/accountRoutes.js
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.");
}

// Keep this service-role client on the server only.
// Never expose SUPABASE_SERVICE_KEY to the frontend.
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// DELETE /api/account/delete
router.delete("/delete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header.",
      });
    }

    // Validate the access token and identify its user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: "Invalid or expired token.",
      });
    }

    // Delete only the user identified by the verified token.
    const { error: deleteError } =
      await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      return res.status(500).json({
        error: deleteError.message || "Failed to delete user.",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error.",
    });
  }
});

module.exports = router;