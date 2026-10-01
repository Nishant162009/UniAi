/* ============================================================
   UNIAI PROFILE ENGINE
   ------------------------------------------------------------
   Shared Supabase authentication
   Profile loading and editing
   Student / Counselor support
   SPA-compatible
   ============================================================ */

(function () {
    "use strict";

    /* =========================================================
       1. CONFIGURATION
       ========================================================= */

    /*
     * IMPORTANT:
     *
     * main.js must create the Supabase client once:
     *
     * window.supabaseApp = window.supabase.createClient(
     *     SUPABASE_URL,
     *     SUPABASE_ANON_KEY
     * );
     *
     * This file reuses that client.
     */

    const supabase = window.supabaseApp || null;

    let profileInitialized = false;
    let authSubscription = null;
    let profileLoading = false;
    let profileRequestId = 0;


    /* =========================================================
       2. PROFILE STATE
       ========================================================= */

    let currentProfile = {
        id: null,
        email: "",
        username: "Guest",
        role: "student",
        avatar: "",
        createdAt: null,
        authenticated: false
    };


    /* =========================================================
       3. DOM HELPERS
       ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }

    function getFirstElement(...ids) {
        for (const id of ids) {
            const element = $(id);

            if (element) {
                return element;
            }
        }

        return null;
    }


    /* =========================================================
       4. SECURITY HELPERS
       ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       5. PROFILE HELPERS
       ========================================================= */

    function cleanUsername(name) {
        if (!name) {
            return "Student";
        }

        return String(name)
            .trim()
            .replace(/\s+/g, " ")
            .split(" ")
            .map(word => {
                if (!word) {
                    return "";
                }

                return (
                    word.charAt(0).toUpperCase() +
                    word.slice(1).toLowerCase()
                );
            })
            .join(" ");
    }


    function getInitials(name) {
        const clean = cleanUsername(name);

        if (!clean || clean === "Student" || clean === "Guest") {
            return "U";
        }

        const parts = clean.split(" ");

        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0)
        ).toUpperCase();
    }


    function normalizeRole(role) {
        return String(role || "student").toLowerCase() === "counselor"
            ? "counselor"
            : "student";
    }


    function getRoleLabel(role) {
        return normalizeRole(role) === "counselor"
            ? "Counselor"
            : "Student";
    }


    function getRoleIcon(role) {
        return normalizeRole(role) === "counselor"
            ? "🧭"
            : "🎓";
    }


    function getRoleDescription(role) {
        return normalizeRole(role) === "counselor"
            ? "University counselor & admissions guide"
            : "Student & study-abroad explorer";
    }


    function getAvatarUrl(user) {
        if (!user) {
            return "";
        }

        const metadata = user.user_metadata || {};

        return (
            metadata.avatar_url ||
            metadata.picture ||
            metadata.avatar ||
            ""
        );
    }


    function getUserDisplayName(user) {
        if (!user) {
            return "Student";
        }

        const metadata = user.user_metadata || {};

        const metadataName =
            metadata.username ||
            metadata.name ||
            metadata.full_name ||
            "";

        const emailName =
            user.email
                ? user.email.split("@")[0]
                : "";

        return cleanUsername(
            metadataName || emailName || "Student"
        );
    }


    function createProfileFromUser(user) {
        if (!user) {
            return {
                id: null,
                email: "",
                username: "Guest",
                role: "student",
                avatar: "",
                createdAt: null,
                authenticated: false
            };
        }

        const metadata = user.user_metadata || {};

        return {
            id: user.id,
            email: user.email || "",
            username: getUserDisplayName(user),
            role: normalizeRole(
                metadata.profile_type ||
                metadata.role ||
                "student"
            ),
            avatar: getAvatarUrl(user),
            createdAt: user.created_at || null,
            authenticated: true
        };
    }


    /* =========================================================
       6. PROFILE ERROR / SIGNED-OUT STATE
       ========================================================= */

    function clearProfileErrors() {
        document
            .querySelectorAll(
                ".profile-load-error, [data-profile-error]"
            )
            .forEach(element => {
                element.textContent = "";
                element.classList.add("hidden");
            });
    }


    function showProfileError(message) {
        document
            .querySelectorAll(
                ".profile-load-error, [data-profile-error]"
            )
            .forEach(element => {
                element.textContent = message;
                element.classList.remove("hidden");
            });

        console.error(
            "[UniAI Profile]",
            message
        );
    }


    function showSignedOutProfile() {
        currentProfile = createProfileFromUser(null);

        const names = document.querySelectorAll(
            ".profile-name-echo, .profile-display-name, [data-profile-name]"
        );

        names.forEach(element => {
            element.textContent = "Guest";
        });

        const emails = document.querySelectorAll(
            ".profile-email, [data-profile-email]"
        );

        emails.forEach(element => {
            element.textContent = "Sign in to access your profile";
        });

        const roles = document.querySelectorAll(
            ".profile-role, [data-profile-role]"
        );

        roles.forEach(element => {
            element.textContent = "Guest";
        });

        const profilePage = $("profilePage");

        if (profilePage) {
            profilePage.dataset.authenticated = "false";
        }

        document
            .querySelectorAll(".profile-loading")
            .forEach(element => {
                element.classList.add("hidden");
            });

        document
            .querySelectorAll("[data-profile-loaded]")
            .forEach(element => {
                element.dataset.profileLoaded = "false";
            });
    }


    /* =========================================================
       7. LOAD PROFILE
       ========================================================= */

    async function loadProfile() {
        const requestId = ++profileRequestId;

        if (!supabase) {
            showProfileError(
                "Profile service is currently unavailable."
            );

            return null;
        }

        if (profileLoading) {
            return currentProfile.authenticated
                ? currentProfile
                : null;
        }

        profileLoading = true;

        try {
            const {
                data: { session },
                error
            } = await supabase.auth.getSession();

            if (requestId !== profileRequestId) {
                return null;
            }

            if (error) {
                console.error(
                    "[UniAI Profile] Session check failed:",
                    error
                );

                showProfileError(
                    "Unable to check your login session."
                );

                return null;
            }

            if (!session?.user) {
                showSignedOutProfile();

                return null;
            }

            currentProfile = createProfileFromUser(
                session.user
            );

            clearProfileErrors();

            updateProfileUI();

            console.log(
                "[UniAI Profile] Profile loaded:",
                currentProfile
            );

            return currentProfile;

        } catch (error) {
            console.error(
                "[UniAI Profile] Failed to load profile:",
                error
            );

            showProfileError(
                "Unable to load your profile."
            );

            return null;

        } finally {
            profileLoading = false;
        }
    }


    /* =========================================================
       8. UPDATE PROFILE UI
       ========================================================= */

    function updateProfileUI() {
        const name = currentProfile.username || "Student";
        const email = currentProfile.email || "No email available";
        const role = getRoleLabel(currentProfile.role);
        const roleIcon = getRoleIcon(currentProfile.role);
        const roleDescription = getRoleDescription(
            currentProfile.role
        );
        const initials = getInitials(name);

        /* Profile names */

        document
            .querySelectorAll(
                ".profile-name-echo, .profile-display-name, [data-profile-name]"
            )
            .forEach(element => {
                element.textContent = name;
            });

        /* Email */

        document
            .querySelectorAll(
                ".profile-email, [data-profile-email]"
            )
            .forEach(element => {
                element.textContent = email;
            });

        /* Role */

        document
            .querySelectorAll(
                ".profile-role, [data-profile-role]"
            )
            .forEach(element => {
                element.textContent = role;
            });

        /* Role description */

        document
            .querySelectorAll(
                ".profile-role-description, [data-profile-role-description]"
            )
            .forEach(element => {
                element.textContent = roleDescription;
            });

        /* Role icon */

        document
            .querySelectorAll(
                ".profile-role-icon, [data-profile-role-icon]"
            )
            .forEach(element => {
                element.textContent = roleIcon;
            });

        /* Avatars */

        document
            .querySelectorAll(
                ".profile-avatar, .profile-avatar-large, .user-avatar.lg, [data-profile-avatar]"
            )
            .forEach(avatar => {
                updateAvatarElement(
                    avatar,
                    name,
                    initials
                );
            });

        /* Navbar */

        const navUsername = $("nav-username");

        if (navUsername) {
            navUsername.textContent = name;
        }

        const navProfileType = $("nav-profile-type");

        if (navProfileType) {
            navProfileType.textContent = role;
        }

        const userDisplayName = $("user-display-name");

        if (userDisplayName) {
            userDisplayName.textContent = name;
        }

        /* Profile page dataset */

        const profilePage = $("profilePage");

        if (profilePage) {
            profilePage.dataset.username = name;
            profilePage.dataset.role = currentProfile.role;
            profilePage.dataset.email = currentProfile.email;
            profilePage.dataset.authenticated =
                currentProfile.authenticated
                    ? "true"
                    : "false";
        }

        /* Account identity */

        const accountIdentity = getFirstElement(
            "profile-account-identity",
            "accountIdentity"
        );

        if (accountIdentity) {
            accountIdentity.innerHTML = `
                <strong>${escapeHTML(name)}</strong>
                <span>${escapeHTML(email)}</span>
            `;
        }

        /* Account role */

        const accountRole = getFirstElement(
            "profile-account-role",
            "accountRole"
        );

        if (accountRole) {
            accountRole.innerHTML = `
                <span>${roleIcon}</span>
                <span>${escapeHTML(role)}</span>
            `;
        }

        /* Edit fields */

        const editUsername = $("edit-username");

        if (
            editUsername &&
            document.activeElement !== editUsername
        ) {
            editUsername.value = currentProfile.username;
        }

        const editRole = $("edit-profile-type");

        if (
            editRole &&
            document.activeElement !== editRole
        ) {
            editRole.value = currentProfile.role;
        }

        /* Created date */

        if (currentProfile.createdAt) {
            const date = new Date(
                currentProfile.createdAt
            );

            const formatted = date.toLocaleDateString(
                undefined,
                {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );

            document
                .querySelectorAll(
                    ".profile-created-date, [data-profile-created]"
                )
                .forEach(element => {
                    element.textContent = formatted;
                });
        }

        /* Reveal profile */

        document
            .querySelectorAll(".profile-loading")
            .forEach(element => {
                element.classList.add("hidden");
            });

        document
            .querySelectorAll(".profile-content")
            .forEach(element => {
                element.classList.remove("hidden");
            });

        document
            .querySelectorAll("[data-profile-loaded]")
            .forEach(element => {
                element.dataset.profileLoaded = "true";
            });
    }


    function updateAvatarElement(
        avatar,
        name,
        initials
    ) {
        if (avatar.tagName === "IMG") {
            if (currentProfile.avatar) {
                avatar.src = currentProfile.avatar;
                avatar.alt = `${name} profile photo`;
                avatar.style.display = "";
            } else {
                avatar.style.display = "none";

                const parent = avatar.parentElement;

                if (parent) {
                    parent.classList.add(
                        "profile-avatar-fallback"
                    );

                    let initialsElement =
                        parent.querySelector(
                            ".avatar-initials"
                        );

                    if (!initialsElement) {
                        initialsElement =
                            document.createElement("span");

                        initialsElement.className =
                            "avatar-initials";

                        parent.appendChild(
                            initialsElement
                        );
                    }

                    initialsElement.textContent = initials;
                }
            }

            return;
        }

        avatar.textContent = initials;
    }


    /* =========================================================
       9. SAVE PROFILE
       ========================================================= */

    async function saveProfile(
        username,
        role,
        errorElement = null
    ) {
        if (!supabase) {
            displaySaveError(
                "Profile service is unavailable.",
                errorElement
            );

            return false;
        }

        username = String(username || "").trim();
        role = normalizeRole(role);

        if (username.length < 2) {
            displaySaveError(
                "Username must contain at least 2 characters.",
                errorElement
            );

            return false;
        }

        if (username.length > 40) {
            displaySaveError(
                "Username must contain no more than 40 characters.",
                errorElement
            );

            return false;
        }

        if (!currentProfile.authenticated) {
            displaySaveError(
                "Please sign in before editing your profile.",
                errorElement
            );

            return false;
        }

        const cleanName = cleanUsername(username);

        const saveButtons = document.querySelectorAll(
            "#edit-profile-form button[type='submit'], #profile-fallback-form button[type='submit']"
        );

        saveButtons.forEach(button => {
            button.disabled = true;

            if (!button.dataset.originalText) {
                button.dataset.originalText =
                    button.innerHTML;
            }

            button.innerHTML = "⏳ Saving...";
        });

        try {
            const {
                data,
                error
            } = await supabase.auth.updateUser({
                data: {
                    username: cleanName,
                    profile_type: role
                }
            });

            if (error) {
                throw error;
            }

            if (data?.user) {
                currentProfile = createProfileFromUser(
                    data.user
                );
            } else {
                currentProfile.username = cleanName;
                currentProfile.role = role;
            }

            updateProfileUI();

            closeProfileEditor();
            closeFallbackEditor();

            showProfileToast(
                "Profile updated successfully ✦",
                "success"
            );

            console.log(
                "[UniAI Profile] Profile successfully updated."
            );

            return true;

        } catch (error) {
            console.error(
                "[UniAI Profile] Profile update failed:",
                error
            );

            displaySaveError(
                error.message ||
                "Failed to update your profile.",
                errorElement
            );

            return false;

        } finally {
            saveButtons.forEach(button => {
                button.disabled = false;

                if (button.dataset.originalText) {
                    button.innerHTML =
                        button.dataset.originalText;
                }
            });
        }
    }


    function displaySaveError(message, errorElement) {
        if (errorElement) {
            errorElement.textContent = message;
        } else {
            showProfileToast(message, "error");
        }
    }


    /* =========================================================
       10. EXISTING EDIT FORM
       ========================================================= */

    function setupExistingEditForm() {
        const form = $("edit-profile-form");

        if (!form || form.dataset.profileBound === "true") {
            return;
        }

        form.dataset.profileBound = "true";

        form.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const username =
                    $("edit-username")?.value.trim() || "";

                const role =
                    $("edit-profile-type")?.value || "student";

                const errorElement =
                    $("edit-error-msg");

                if (errorElement) {
                    errorElement.textContent = "";
                }

                await saveProfile(
                    username,
                    role,
                    errorElement
                );
            }
        );
    }


    /* =========================================================
       11. PROFILE EDITOR
       ========================================================= */

    function openProfileEditor() {
        if (!currentProfile.authenticated) {
            showProfileToast(
                "Please sign in to edit your profile.",
                "error"
            );

            return;
        }

        const modal = $("edit-profile-overlay");

        const usernameInput = $("edit-username");
        const roleSelect = $("edit-profile-type");

        if (usernameInput) {
            usernameInput.value =
                currentProfile.username;
        }

        if (roleSelect) {
            roleSelect.value =
                currentProfile.role;
        }

        if (modal) {
            modal.style.display = "flex";

            requestAnimationFrame(() => {
                modal.classList.add(
                    "profile-modal-open"
                );
            });

            setTimeout(() => {
                usernameInput?.focus();
            }, 100);

            return;
        }

        createFallbackEditModal();
    }


    function createFallbackEditModal() {
        let overlay = $("profile-editor-fallback");

        if (!overlay) {
            overlay = document.createElement("div");

            overlay.id = "profile-editor-fallback";
            overlay.className = "profile-editor-fallback";

            overlay.innerHTML = `
                <div class="profile-editor-modal">

                    <button
                        type="button"
                        class="profile-modal-close"
                        id="profile-fallback-close"
                        aria-label="Close"
                    >
                        ×
                    </button>

                    <div class="profile-modal-icon">
                        ✦
                    </div>

                    <div class="profile-modal-heading">
                        <span>PERSONAL IDENTITY</span>
                        <h2>Edit Profile</h2>
                        <p>
                            Update how UniAI represents you
                            across your workspace.
                        </p>
                    </div>

                    <form id="profile-fallback-form">

                        <div class="profile-field">
                            <label for="profile-fallback-username">
                                Username
                            </label>

                            <input
                                id="profile-fallback-username"
                                type="text"
                                maxlength="40"
                                autocomplete="nickname"
                                placeholder="Enter your username"
                                required
                            >
                        </div>

                        <div class="profile-field">
                            <label for="profile-fallback-role">
                                Profile Type
                            </label>

                            <select id="profile-fallback-role">
                                <option value="student">
                                    🎓 Student
                                </option>

                                <option value="counselor">
                                    🧭 Counselor
                                </option>
                            </select>
                        </div>

                        <div
                            id="profile-fallback-error"
                            class="profile-form-error"
                        ></div>

                        <button
                            type="submit"
                            class="glow-btn profile-save-btn"
                        >
                            <span>Save Profile</span>
                            <span>→</span>
                        </button>

                    </form>

                </div>
            `;

            document.body.appendChild(overlay);

            const form = $("profile-fallback-form");

            form?.addEventListener(
                "submit",
                handleFallbackSubmit
            );

            $("profile-fallback-close")
                ?.addEventListener(
                    "click",
                    closeFallbackEditor
                );

            overlay.addEventListener(
                "click",
                event => {
                    if (event.target === overlay) {
                        closeFallbackEditor();
                    }
                }
            );
        }

        $("profile-fallback-username").value =
            currentProfile.username;

        $("profile-fallback-role").value =
            currentProfile.role;

        overlay.style.display = "flex";

        requestAnimationFrame(() => {
            overlay.classList.add(
                "profile-modal-open"
            );
        });

        setTimeout(() => {
            $("profile-fallback-username")?.focus();
        }, 100);
    }


    async function handleFallbackSubmit(event) {
        event.preventDefault();

        const username =
            $("profile-fallback-username")
                ?.value.trim() || "";

        const role =
            $("profile-fallback-role")
                ?.value || "student";

        const errorElement =
            $("profile-fallback-error");

        if (errorElement) {
            errorElement.textContent = "";
        }

        await saveProfile(
            username,
            role,
            errorElement
        );
    }


    function closeProfileEditor() {
        const overlay = $("edit-profile-overlay");

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "profile-modal-open"
        );

        setTimeout(() => {
            overlay.style.display = "none";
        }, 180);
    }


    function closeFallbackEditor() {
        const overlay = $("profile-editor-fallback");

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "profile-modal-open"
        );

        setTimeout(() => {
            overlay.style.display = "none";
        }, 180);
    }


    /* =========================================================
       12. TOAST SYSTEM
       ========================================================= */

    function showProfileToast(
        message,
        type = "success"
    ) {
        let toast = $("profile-toast");

        if (!toast) {
            toast = document.createElement("div");

            toast.id = "profile-toast";
            toast.className = "profile-toast";

            document.body.appendChild(toast);
        }

        toast.className =
            `profile-toast profile-toast-${type}`;

        toast.innerHTML = `
            <span class="profile-toast-icon">
                ${type === "success" ? "✓" : "!"}
            </span>

            <span>
                ${escapeHTML(message)}
            </span>
        `;

        requestAnimationFrame(() => {
            toast.classList.add(
                "profile-toast-visible"
            );
        });

        clearTimeout(toast._hideTimer);

        toast._hideTimer = setTimeout(() => {
            toast.classList.remove(
                "profile-toast-visible"
            );
        }, 3500);
    }


    /* =========================================================
       13. MODAL CONTROLS
       ========================================================= */

    function setupModalControls() {
        const overlay = $("edit-profile-overlay");

        if (
            !overlay ||
            overlay.dataset.profileModalBound === "true"
        ) {
            return;
        }

        overlay.dataset.profileModalBound = "true";

        overlay.addEventListener(
            "click",
            event => {
                if (event.target === overlay) {
                    closeProfileEditor();
                }
            }
        );
    }


    function setupEscapeHandler() {
        if (document.documentElement.dataset.profileEscapeBound) {
            return;
        }

        document.documentElement.dataset.profileEscapeBound = "true";

        document.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Escape") {
                    return;
                }

                closeProfileEditor();
                closeFallbackEditor();
            }
        );
    }


    /* =========================================================
       14. PROFILE PAGE SETUP
       ========================================================= */

    function setupProfilePage() {
        const profilePage = $("profilePage");

        if (!profilePage) {
            return;
        }

        if (profileInitialized) {
            return;
        }

        profileInitialized = true;

        setupExistingEditForm();
        setupModalControls();
        setupEscapeHandler();

        document
            .querySelectorAll("[data-profile-edit]")
            .forEach(button => {
                if (button.dataset.profileEditBound === "true") {
                    return;
                }

                button.dataset.profileEditBound = "true";

                button.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();
                        openProfileEditor();
                    }
                );
            });

        loadProfile();
    }


    /* =========================================================
       15. AUTH STATE LISTENER
       ========================================================= */

    function setupAuthListener() {
        if (!supabase || authSubscription) {
            return;
        }

        const {
            data
        } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log(
                    "[UniAI Profile] Auth event:",
                    event
                );

                if (event === "SIGNED_OUT") {
                    showSignedOutProfile();
                    return;
                }

                if (!session?.user) {
                    return;
                }

                currentProfile =
                    createProfileFromUser(session.user);

                updateProfileUI();
            }
        );

        authSubscription = data.subscription;
    }


    /* =========================================================
       16. SPA NAVIGATION OBSERVER
       ========================================================= */

    let profilePageObserver = null;

    function setupProfileObserver() {
        const profilePage = $("profilePage");

        if (!profilePage || profilePageObserver) {
            return;
        }

        profilePageObserver = new MutationObserver(
            mutations => {
                for (const mutation of mutations) {
                    if (
                        mutation.type === "attributes" &&
                        mutation.attributeName === "class"
                    ) {
                        const target = mutation.target;

                        if (
                            target.id === "profilePage" &&
                            !target.classList.contains("hidden")
                        ) {
                            loadProfile();
                        }
                    }
                }
            }
        );

        profilePageObserver.observe(
            profilePage,
            {
                attributes: true
            }
        );
    }


    /* =========================================================
       17. PUBLIC API
       ========================================================= */

    window.UniAIProfile = {
        load: loadProfile,
        refresh: loadProfile,
        openEditor: openProfileEditor,
        closeEditor: closeProfileEditor,
        save: saveProfile,

        getProfile: function () {
            return { ...currentProfile };
        }
    };

    window.openEditModal = openProfileEditor;
    window.closeEditModal = closeProfileEditor;


    /* =========================================================
       18. INITIALIZATION
       ========================================================= */

    function initialize() {
        setupAuthListener();
        setupProfilePage();
        setupProfileObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

})();