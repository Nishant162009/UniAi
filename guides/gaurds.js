/* ==========================================================================
   UniAI — guide page guard
   Include on EVERY page inside /guides/ (see the <head> snippet below).
   Signed-out visitors are sent to index.html, where the sign-in modal opens;
   after login they continue to the guide they asked for.

   <head> snippet (must come before any other scripts):

     <style id="auth-gate">html{visibility:hidden}</style>
     <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
     <script src="guard.js"></script>
   ========================================================================== */

(async () => {
  "use strict";

  // Same values as CONFIG in script.js
  const SUPABASE_URL = "https://fmphoudjslmwsebqttlf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcGhvdWRqc2xtd3NlYnF0dGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjAxNTQsImV4cCI6MjA5OTQzNjE1NH0.w10MlWop_go_qp7eIyYYFIy3ts38ReYmZJjQJqKZKmM";

  const reveal = () => {
    const gate = document.getElementById("auth-gate");
    if (gate) gate.remove();
  };

  const kick = () => {
    const page = location.pathname.split("/").pop();
    location.replace(
      `../index.html?login=required&next=${encodeURIComponent("guides/" + page)}`
    );
  };

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await client.auth.getSession();

    if (data && data.session) reveal();
    else kick();
  } catch (err) {
    kick(); // fail closed
  }
})();