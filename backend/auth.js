// Initialize Supabase (Use your exact project keys here)
const SUPABASE_URL = "https://fmphoudjslmwsebqttlf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcGhvdWRqc2xtd3NlYnF0dGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjAxNTQsImV4cCI6MjA5OTQzNjE1NH0.w10MlWop_go_qp7eIyYYFIy3ts38ReYmZJjQJqKZKmM";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const submitBtn = document.getElementById("submit-btn");
const toggleLink = document.getElementById("toggle-link");
const toggleText = document.getElementById("toggle-text");
const errorMsg = document.getElementById("error-msg");

let isSignUpMode = false;

// Toggle between Login and Sign Up UI states
toggleLink.addEventListener("click", () => {
    isSignUpMode = !isSignUpMode;
    errorMsg.classList.add("error-hidden");
    
    if (isSignUpMode) {
        authTitle.innerText = "Create Your Account";
        authSubtitle.innerText = "Join free to analyze global admission matches";
        submitBtn.innerText = "Sign Up";
        toggleText.innerHTML = 'Already have an account? <span id="toggle-link">Sign In</span>';
    } else {
        authTitle.innerText = "Welcome to UniAI";
        authSubtitle.innerText = "Sign in to start matching with global universities";
        submitBtn.innerText = "Sign In";
        toggleText.innerHTML = 'Don\'t have an account? <span id="toggle-link">Sign Up for Free</span>';
    }
    // Re-bind the click event listener to the newly generated span link
    document.getElementById("toggle-link").addEventListener("click", arguments.callee);
});

// Handle authentication requests
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.classList.add("error-hidden");
    
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (isSignUpMode) {
        // --- SIGN UP LOGIC ---
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return showError(error.message);
        
        alert("Success! Check your email inbox for a verification confirmation link.");
    } else {
        // --- LOGIN LOGIC ---
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return showError(error.message);
        
        // Success: Redirect to the core system chat interface
        window.location.href = "/index.html";
    }
});

function showError(message) {
    errorMsg.innerText = `⚠️ ${message}`;
    errorMsg.classList.remove("error-hidden");
}