document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================
       HELPER FUNCTIONS
    ========================================== */

    function saveData(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getData(key, fallback = {}) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function showMessage(message) {
        alert(message);
    }


    /* ==========================================
       SETTINGS MENU - SCROLL TO SECTION
    ========================================== */

    const menuButtons = document.querySelectorAll(
        ".settings-menu button[data-target]"
    );

    menuButtons.forEach(button => {
        button.addEventListener("click", function () {

            const targetId = this.dataset.target;
            const target = document.getElementById(targetId);

            if (target) {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

            menuButtons.forEach(item =>
                item.classList.remove("active")
            );

            this.classList.add("active");
        });
    });


    /* ==========================================
       PROFILE SETTINGS
    ========================================== */

    const profileFields = [
        "fullName",
        "email",
        "college",
        "branch",
        "phone",
        "year"
    ];

    function loadProfile() {
        const profile = getData("scrnsProfile", {});

        profileFields.forEach(id => {
            const field = document.getElementById(id);

            if (field && profile[id] !== undefined) {
                field.value = profile[id];
            }
        });
    }

    loadProfile();

    const saveProfileBtn = document.getElementById(
        "saveProfileBtn"
    );

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", function () {

            const profile = {};

            profileFields.forEach(id => {
                const field = document.getElementById(id);

                if (field) {
                    profile[id] = field.value.trim();
                }
            });

            const email = document.getElementById("email");

            if (email && !email.checkValidity()) {
                showMessage("Please enter a valid email address.");
                email.focus();
                return;
            }

            saveData("scrnsProfile", profile);

            showMessage("Profile saved successfully!");
        });
    }


    /* ==========================================
       PROFILE PHOTO UPLOAD
    ========================================== */

    const changePhotoBtn = document.getElementById(
        "changePhotoBtn"
    );

    const photoInput = document.getElementById(
        "profilePhotoInput"
    );

    function displayPhoto(imageData) {
        const photo = document.querySelector(".profile-photo");

        if (!photo) return;

        photo.innerHTML = "";

        const image = document.createElement("img");
        image.src = imageData;
        image.alt = "Profile photo";

        photo.appendChild(image);
    }

    if (changePhotoBtn && photoInput) {

        changePhotoBtn.addEventListener("click", function () {
            photoInput.click();
        });

        photoInput.addEventListener("change", function () {

            const file = this.files[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {
                showMessage("Please select an image file.");
                this.value = "";
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showMessage("Please choose an image smaller than 2 MB.");
                this.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = function (event) {
                try {
                    localStorage.setItem(
                        "scrnsProfilePhoto",
                        event.target.result
                    );

                    displayPhoto(event.target.result);
                } catch (error) {
                    showMessage(
                        "Photo could not be saved. Try a smaller image."
                    );
                }
            };

            reader.readAsDataURL(file);
        });
    }

    const storedPhoto = localStorage.getItem(
        "scrnsProfilePhoto"
    );

    if (storedPhoto) {
        displayPhoto(storedPhoto);
    }


    /* ==========================================
       MAP PREFERENCES - LOAD
    ========================================== */

    function loadMapSettings() {
        const settings = getData("scrnsMapSettings", {});

        [
            "mapStyle",
            "mapProvider",
            "mapZoom",
            "mapDistanceUnit"
        ].forEach(id => {

            const field = document.getElementById(id);

            if (field && settings[id] !== undefined) {
                field.value = settings[id];
            }
        });

        [
            "showTrafficLayer",
            "showLocationMarker"
        ].forEach(id => {

            const field = document.getElementById(id);

            if (field && settings[id] !== undefined) {
                field.checked = settings[id];
            }
        });

        if (settings.markerStyle) {
            document.querySelectorAll(".marker-option")
                .forEach(button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.marker === settings.markerStyle
                    );
                });
        }
    }

    loadMapSettings();


    /* ==========================================
       MAP MARKER SELECTION
    ========================================== */

    document.querySelectorAll(".marker-option")
        .forEach(button => {

            button.addEventListener("click", function () {

                document.querySelectorAll(".marker-option")
                    .forEach(item =>
                        item.classList.remove("active")
                    );

                this.classList.add("active");
            });
        });


    /* ==========================================
       SAVE MAP PREFERENCES
    ========================================== */

    const saveMapBtn = document.getElementById("saveMapBtn");

    if (saveMapBtn) {
        saveMapBtn.addEventListener("click", function () {

            const selectedMarker = document.querySelector(
                ".marker-option.active"
            );

            const settings = {
                mapStyle: document.getElementById("mapStyle").value,
                mapProvider: document.getElementById("mapProvider").value,
                mapZoom: document.getElementById("mapZoom").value,
                mapDistanceUnit: document.getElementById(
                    "mapDistanceUnit"
                ).value,

                showTrafficLayer: document.getElementById(
                    "showTrafficLayer"
                ).checked,

                showLocationMarker: document.getElementById(
                    "showLocationMarker"
                ).checked,

                markerStyle: selectedMarker
                    ? selectedMarker.dataset.marker
                    : "blue"
            };

            saveData("scrnsMapSettings", settings);

            showMessage("Map settings saved successfully!");
        });
    }


    /* ==========================================
       NAVIGATION PREFERENCES - LOAD
    ========================================== */

    function loadNavigationSettings() {
        const settings = getData(
            "scrnsNavigationSettings",
            {}
        );

        [
            "defaultAlgorithm",
            "routePreference"
        ].forEach(id => {

            const field = document.getElementById(id);

            if (field && settings[id] !== undefined) {
                field.value = settings[id];
            }
        });

        [
            "settingsVoiceNavigation",
            "turnInstructions",
            "autoReroute",
            "avoidTolls"
        ].forEach(id => {

            const field = document.getElementById(id);

            if (field && settings[id] !== undefined) {
                field.checked = settings[id];
            }
        });
    }

    loadNavigationSettings();


    /* ==========================================
       SAVE NAVIGATION PREFERENCES
    ========================================== */

    const saveNavigationBtn = document.getElementById(
        "saveNavigationBtn"
    );

    if (saveNavigationBtn) {
        saveNavigationBtn.addEventListener("click", function () {

            const settings = {
                defaultAlgorithm: document.getElementById(
                    "defaultAlgorithm"
                ).value,

                routePreference: document.getElementById(
                    "routePreference"
                ).value,

                settingsVoiceNavigation: document.getElementById(
                    "settingsVoiceNavigation"
                ).checked,

                turnInstructions: document.getElementById(
                    "turnInstructions"
                ).checked,

                autoReroute: document.getElementById(
                    "autoReroute"
                ).checked,

                avoidTolls: document.getElementById(
                    "avoidTolls"
                ).checked
            };

            saveData("scrnsNavigationSettings", settings);

            showMessage("Navigation settings saved successfully!");
        });
    }

    /* ==========================================
       NOTIFICATIONS - LOAD
    ========================================== */

    function loadNotificationSettings() {
        const settings = getData(
            "scrnsNotificationSettings",
            {}
        );

        [
            "routeUpdates",
            "trafficAlerts",
            "systemAlerts",
            "emailNotifications"
        ].forEach(id => {

            const field = document.getElementById(id);

            if (field && settings[id] !== undefined) {
                field.checked = settings[id];
            }
        });
    }

    loadNotificationSettings();


    /* ==========================================
       SAVE NOTIFICATIONS
    ========================================== */

    const saveNotificationBtn = document.getElementById(
        "saveNotificationBtn"
    );

    if (saveNotificationBtn) {
        saveNotificationBtn.addEventListener("click", function () {

            const settings = {
                routeUpdates: document.getElementById(
                    "routeUpdates"
                ).checked,

                trafficAlerts: document.getElementById(
                    "trafficAlerts"
                ).checked,

                systemAlerts: document.getElementById(
                    "systemAlerts"
                ).checked,

                emailNotifications: document.getElementById(
                    "emailNotifications"
                ).checked
            };

            saveData("scrnsNotificationSettings", settings);

            showMessage("Notification settings saved successfully!");
        });
    }


    /* ==========================================
       THEME MODE
    ========================================== */

    const themeOptions = document.querySelectorAll(
        ".theme-option"
    );

    function applyTheme(theme) {

        if (theme === "system") {
            const systemDark = window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches;

            document.body.classList.toggle(
                "dark-theme",
                systemDark
            );

        } else {
            document.body.classList.toggle(
                "dark-theme",
                theme === "dark"
            );
        }

        themeOptions.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.theme === theme
            );
        });

        localStorage.setItem("scrnsTheme", theme);
    }

    themeOptions.forEach(button => {
        button.addEventListener("click", function () {
            applyTheme(this.dataset.theme);
        });
    });

    applyTheme(
        localStorage.getItem("scrnsTheme") || "light"
    );


    /* ==========================================
       PRIMARY COLOR
    ========================================== */

    const colorOptions = document.querySelectorAll(
        ".color-option"
    );

    function applyPrimaryColor(color) {

        document.documentElement.style.setProperty(
            "--primary-color",
            color
        );

        colorOptions.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.color === color
            );
        });

        localStorage.setItem(
            "scrnsPrimaryColor",
            color
        );
    }

    colorOptions.forEach(button => {
        button.addEventListener("click", function () {
            applyPrimaryColor(this.dataset.color);
        });
    });

    applyPrimaryColor(
        localStorage.getItem("scrnsPrimaryColor") || "#1769ff"
    );


    /* ==========================================
       FONT SIZE
    ========================================== */

    const fontSizeSelect = document.getElementById("fontSize");

    function applyFontSize(size) {

        const sizes = {
            small: "12px",
            medium: "14px",
            large: "16px"
        };

        document.body.style.fontSize =
            sizes[size] || sizes.medium;

        if (fontSizeSelect) {
            fontSizeSelect.value =
                sizes[size] ? size : "medium";
        }

        localStorage.setItem("scrnsFontSize", size);
    }

    if (fontSizeSelect) {

        fontSizeSelect.addEventListener("change", function () {
            applyFontSize(this.value);
        });

        applyFontSize(
            localStorage.getItem("scrnsFontSize") || "medium"
        );
    }


    /* ==========================================
       SAVE APPEARANCE
    ========================================== */

    const saveAppearanceBtn = document.getElementById(
        "saveAppearanceBtn"
    );

    if (saveAppearanceBtn) {
        saveAppearanceBtn.addEventListener("click", function () {

            const settings = {
                theme: localStorage.getItem("scrnsTheme") || "light",
                primaryColor: localStorage.getItem(
                    "scrnsPrimaryColor"
                ) || "#1769ff",
                fontSize: localStorage.getItem(
                    "scrnsFontSize"
                ) || "medium"
            };

            saveData("scrnsAppearanceSettings", settings);

            showMessage("Appearance settings saved successfully!");
        });
    }


    /* ==========================================
       CHANGE PASSWORD
       Secure backend integration required
    ========================================== */

    const changePasswordBtn = document.getElementById("changePasswordBtn");


    /* ==========================================
       LOGOUT
    ========================================== */

    function logoutUser() {

        const confirmed = confirm(
            "Are you sure you want to logout?"
        );

        if (!confirmed) return;

        /*
          Use the project's existing authentication logout
          route if available. This avoids pretending that
          removing a browser flag ends a server session.
        */
    }

function handleLogout(buttonId) {
    const logoutBtn = document.getElementById(buttonId);

    if (!logoutBtn || logoutBtn.dataset.logoutBound === "true") {
        return;
    }

    logoutBtn.dataset.logoutBound = "true";

    logoutBtn.addEventListener("click", async function (event) {
        event.preventDefault();

        const confirmed = confirm("Are you sure you want to logout?");

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                alert(result.message || "Logout failed. Please try again.");
                return;
            }

            localStorage.removeItem("smartCityLoggedIn");
            localStorage.removeItem("currentUser");
            localStorage.removeItem("currentUserName");
            localStorage.removeItem("currentUserName");
            localStorage.removeItem("currentUser");

            window.location.replace("/login.html");

        } catch (error) {
            console.error("Logout failed:", error);
            alert("Unable to logout. Please check the Flask server.");
        }
    });
}

handleLogout("settingsLogoutBtn");
handleLogout("accountLogoutBtn");

    /* ==========================================
       SEARCH SETTINGS
    ========================================== */

    const searchInput = document.getElementById(
        "settingsSearch"
    );

    if (searchInput) {

        searchInput.addEventListener("input", function () {

            const query = this.value.toLowerCase().trim();

            const cards = document.querySelectorAll(
                ".settings-content .settings-card"
            );

            cards.forEach(card => {

                if (!query) {
                    card.style.display = "";
                    return;
                }

                const matches = card.innerText
                    .toLowerCase()
                    .includes(query);

                card.style.display = matches ? "" : "none";
            });

            /*
              When the search is cleared, restore the original
              two-column card layout.
            */
            if (!query) {
                document.querySelectorAll(
                    ".preference-cards"
                ).forEach(group => {
                    group.style.display = "";
                });
            }
        });
    }


    /* ==========================================
       FINISHED
    ========================================== */

    console.log("Smart City Settings loaded successfully.");

    // Top-right Admin dropdown
    const adminDropdownBtn = document.getElementById("adminDropdownBtn");
    const adminDropdown = document.getElementById("adminDropdown");

    if (adminDropdownBtn && adminDropdown) {
        adminDropdown.hidden = true;

        adminDropdownBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            adminDropdown.hidden = !adminDropdown.hidden;
        });

        document.addEventListener("click", function (event) {
            if (!document.getElementById("adminMenu").contains(event.target)) {
                adminDropdown.hidden = true;
            }
        });
    }

    document.getElementById("adminProfileBtn")?.addEventListener("click", function () {
        adminDropdown.hidden = true;
        document.getElementById("profileSection")
            ?.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("adminLogoutBtn")?.addEventListener("click", logoutUser);

    // Notification panel
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationButton = document.getElementById("settingsNotificationBtn");

    if (notificationButton && notificationPanel) {
        notificationButton.addEventListener("click", function () {
            notificationPanel.hidden = !notificationPanel.hidden;
        });
    }

    document.getElementById("closeNotificationBtn")?.addEventListener("click", function () {
        notificationPanel.hidden = true;
    });

    // Open and close the password dialog
    const passwordOverlay = document.getElementById("passwordOverlay");

    document.getElementById("changePasswordBtn")?.addEventListener("click", function () {
        passwordOverlay.hidden = false;
        document.getElementById("currentPassword").focus();
    });

    document.getElementById("closePasswordBtn")?.addEventListener("click", function () {
        passwordOverlay.hidden = true;
        document.getElementById("changePasswordForm").reset();
        document.getElementById("passwordMessage").textContent = "";
    });

    // Submit to a secure backend endpoint; never store passwords in localStorage.
    document.getElementById("changePasswordForm")?.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("passwordMessage");

        if (newPassword !== confirmPassword) {
            message.textContent = "New passwords do not match.";
            return;
        }

        if (newPassword.length < 8) {
            message.textContent = "Password must contain at least 8 characters.";
            return;
        }

        message.textContent = "Updating password...";

        try {
            const response = await fetch("/api/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json();

            message.textContent = result.message ||
                (response.ok ? "Password updated." : "Password update failed.");
        } catch (error) {
            message.textContent = "Could not connect to the server.";
        }
    });

});
