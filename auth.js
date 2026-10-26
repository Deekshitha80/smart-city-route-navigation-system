// =====================================================
// SMART CITY ROUTE NAVIGATION SYSTEM
// AUTHENTICATION
// =====================================================


// =====================================================
// REGISTER
// =====================================================

async function registerUser(event) {
    if (event) event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!fullName || !email || !username || !password || !confirmPassword) {
        alert("Please fill all fields.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        return;
    }

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                fullName: fullName,
                email: email,
                username: username,
                password: password,
                confirmPassword: confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || "Registration failed.");
            return;
        }

        alert("Registration successful! Please login.");
        window.location.href = "login.html";

    } catch (error) {
        console.error("Registration error:", error);
        alert("Unable to connect to the server. Please try again.");
    }
}


// =====================================================
// LOGIN
// Supports EMAIL or USERNAME
// =====================================================

async function loginUser(event){

    if (event) {
        event.preventDefault();
    }

    const loginInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (!loginInput || !passwordInput) {
        alert("Login fields not found.");
        return;
    }

    const loginValue = loginInput.value.trim();
    const password = passwordInput.value;

    if (!loginValue || !password) {
        alert("Please enter email/username and password.");
        return;
    }

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email: loginValue,
                password: password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || "Login failed.");
            return;
        }

        localStorage.setItem("smartCityLoggedIn", "true");
        localStorage.setItem(
            "currentUser",
            result.user.username || ""
        );
        localStorage.setItem(
            "currentUserName",
            result.user.fullName || ""
        );

        alert("Login successful!");
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Login error:", error);
        alert("Could not connect to the server. Please check Flask.");
    }
}


// =====================================================
// PASSWORD VISIBILITY
// =====================================================

function togglePassword() {

    const password =
        document.getElementById("password");


    if (!password) {
        return;
    }


    if (password.type === "password") {

        password.type = "text";

    } else {

        password.type = "password";

    }

}



// =====================================================
// FORGOT PASSWORD
// =====================================================

async function forgotPassword() {
    const email = prompt("Enter your registered email address:");

    if (email === null || !email.trim()) {
        return;
    }

    const emailValue = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        alert("Please enter a valid email address.");
        return;
    }

    try {
        const response = await fetch("/api/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email: emailValue
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || "Password recovery is not available.");
            return;
        }

        alert(result.message || "Please check your email for password reset instructions.");

    } catch (error) {
        console.error("Password recovery error:", error);
        alert("Unable to connect to the server. Please try again.");
    }
}

// =====================================================
// SOCIAL LOGIN
// =====================================================

function socialLogin(provider) {

    // Real OAuth login is handled by the Flask backend.
    // The backend creates the provider session and returns to oauth-success.html.
    const routes = {
        Google: "/auth/google",
        Facebook: "/auth/facebook"
    };

    const loginUrl = routes[provider];

    if (!loginUrl) {
        alert("Unsupported login provider.");
        return;
    }

    window.location.href = loginUrl;

}



// =====================================================
// CHECK LOGIN
// =====================================================

function checkLogin() {

    const loggedIn =
        localStorage.getItem(
            "smartCityLoggedIn"
        );


    if (loggedIn !== "true") {

        window.location.href =
            "login.html";

    }

}



/* =========================================================
   SMART CITY - LOGOUT
   ========================================================= */

function logoutUser() {

    const confirmLogout = confirm(
        "Are you sure you want to logout?"
    );

    if (confirmLogout) {

        // Clear the Flask OAuth session as well as the existing frontend session.
        fetch("/auth/logout", {
            method: "POST",
            credentials: "same-origin"
        }).catch(function () {});

        localStorage.removeItem("smartCityLoggedIn");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("currentUserName");
        localStorage.removeItem("smartCitySocialUser");

        // Go to login page
        window.location.href = "login.html";

    } else {

        // Stay on the current page
        return;

    }
}