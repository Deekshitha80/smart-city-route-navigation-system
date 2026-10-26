// =====================================================
// SMART CITY DASHBOARD
// =====================================================


// Get registered users
function getTotalUsers() {

    const user = localStorage.getItem("smartCityUser");

    if (user) {
        return 1;
    }

    return 0;
}


// Get saved routes
function getRoutes() {

    const routes =
        JSON.parse(
            localStorage.getItem("smartCityRoutes")
        ) || [];

    return routes;
}


// Calculate distance
function calculateDistance(routes) {

    let total = 0;

    routes.forEach(route => {

        if (route.distance) {
            total += Number(route.distance);
        }

    });

    return total;
}


// Calculate CO2
function calculateCO2(distance) {

    /*
       Estimated CO2 saving:
       0.12 kg per optimized kilometer
    */

    return distance * 0.12;
}


// Load dashboard
function loadDashboard() {

    const routes = getRoutes();

    const totalUsers =
        getTotalUsers();

    const totalRoutes =
        routes.length;

    const distance =
        calculateDistance(routes);

    const co2 =
        calculateCO2(distance);


    // Statistics

    document.getElementById("totalRoutes")
        .textContent = totalRoutes;


    document.getElementById("totalUsers")
        .textContent = totalUsers;


    document.getElementById("distanceSaved")
        .textContent =
        distance.toFixed(1) + " km";


    document.getElementById("co2Saved")
        .textContent =
        co2.toFixed(1) + " kg";


    // Username

    const username =
        localStorage.getItem("currentUser");

    if (username) {

        document.getElementById(
            "dashboardUsername"
        ).textContent = username;

    }


    // Recent routes

    loadRecentRoutes(routes);
}


// Recent routes
function loadRecentRoutes(routes) {

    const container =
        document.getElementById(
            "recentRoutes"
        );


    if (routes.length === 0) {

        container.innerHTML = `
            <div class="empty-route">
                No routes searched yet.
            </div>
        `;

        return;
    }


    // Last 3 routes
    const recent =
        routes.slice(-3).reverse();


    container.innerHTML = "";


    recent.forEach(route => {

        const item =
            document.createElement("div");

        item.className =
            "recent-route";


        item.innerHTML = `

            <div class="route-icon">
                📍
            </div>

            <div class="route-name">

                <b>
                    ${route.from}
                    →
                    ${route.to}
                </b>

                <span>
                    ${route.distance} km
                </span>

            </div>

        `;


        container.appendChild(item);

    });
}


// Logout
function logoutUser() {

    localStorage.setItem(
        "smartCityLoggedIn",
        "false"
    );

    window.location.href =
        "login.html";
}


// Start
document.addEventListener(
    "DOMContentLoaded",
    loadDashboard
);