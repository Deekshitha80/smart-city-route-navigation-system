document.addEventListener("DOMContentLoaded", function () {

    loadRouteHistory();

    document
        .getElementById("historySearchBtn")
        ?.addEventListener("click", loadRouteHistory);

    document
        .getElementById("historySearch")
        ?.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {
                loadRouteHistory();
            }

        });

    document
        .getElementById("clearHistoryBtn")
        ?.addEventListener("click", clearHistory);

});


/* ================= LOAD MYSQL HISTORY ================= */

async function loadRouteHistory() {

    try {

        const response = await fetch("/api/route-history");

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load route history."
            );
        }

        let routes = data.routes || [];

        routes = applyFilters(routes);

        displayRoutes(routes);

        updateSummary(data.routes || []);

    }
    catch (error) {

        console.error("Route history error:", error);

        showEmptyState(
            "Unable to load route history."
        );
    }
}


/* ================= FILTERS ================= */

/* ================= FILTERS ================= */

function applyFilters(routes) {

    const search =
        document
            .getElementById("historySearch")
            ?.value
            .trim()
            .toLowerCase() || "";


    const algorithm =
        document
            .getElementById("algorithmFilter")
            ?.value || "all";


    const selectedDate =
        document
            .getElementById("historyDate")
            ?.value || "";


    return routes.filter(function (route) {

        const source =
            String(
                route.source || ""
            ).toLowerCase();


        const destination =
            String(
                route.destination || ""
            ).toLowerCase();


        const routeAlgorithm =
            String(
                route.algorithm || ""
            )
            .trim()
            .toLowerCase();


        /* ================= SOURCE / DESTINATION ================= */

        const matchesSearch =
            !search ||
            source.includes(search) ||
            destination.includes(search);


        /* ================= ALGORITHM ================= */

        let matchesAlgorithm = true;


        if (
            algorithm &&
            algorithm.toLowerCase() !== "all"
        ) {

            const selectedAlgorithm =
                algorithm
                    .trim()
                    .toLowerCase();


            if (
                selectedAlgorithm === "a*" ||
                selectedAlgorithm === "astar" ||
                selectedAlgorithm === "a star"
            ) {

                matchesAlgorithm =
                    routeAlgorithm === "a* search" ||
                    routeAlgorithm === "a*" ||
                    routeAlgorithm === "astar" ||
                    routeAlgorithm === "a star";

            }

            else if (
                selectedAlgorithm === "bfs"
            ) {

                matchesAlgorithm =
                    routeAlgorithm === "bfs";

            }

            else if (
                selectedAlgorithm === "dfs"
            ) {

                matchesAlgorithm =
                    routeAlgorithm === "dfs";

            }

            else if (
                selectedAlgorithm.includes(
                    "best first"
                )
            ) {

                matchesAlgorithm =
                    routeAlgorithm.includes(
                        "best first"
                    );

            }

            else {

                matchesAlgorithm =
                    routeAlgorithm ===
                    selectedAlgorithm;

            }

        }


        /* ================= DATE ================= */

        let matchesDate = true;


        if (selectedDate) {

            const routeDate =
                getDatabaseDate(
                    route.searched_at
                );


            matchesDate =
                routeDate === selectedDate;

        }


        return (
            matchesSearch &&
            matchesAlgorithm &&
            matchesDate
        );

    });

}


/* ================= DATABASE DATE ================= */

function getDatabaseDate(value) {

    if (!value) {
        return "";
    }


    const text =
        String(value);


    /*
       MySQL / Flask normally gives:
       2026-10-08T12:51:00
       or
       2026-10-08 12:51:00
    */

    const match =
        text.match(
            /^(\d{4}-\d{2}-\d{2})/
        );


    if (match) {

        return match[1];

    }


    const date =
        new Date(value);


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return (
        year +
        "-" +
        month +
        "-" +
        day
    );

}

/* ================= DISPLAY TABLE ================= */

function displayRoutes(routes) {

    const tableBody =
        document.getElementById("historyTableBody");

    const empty =
        document.getElementById("historyEmpty");

    const count =
        document.getElementById("historyCount");


    if (!tableBody) return;


    if (count) {

        count.textContent =
            routes.length +
            (routes.length === 1 ? " route" : " routes");

    }


    if (routes.length === 0) {

        tableBody.innerHTML = "";

        if (empty) {
            empty.style.display = "block";
        }

        return;
    }


    if (empty) {
        empty.style.display = "none";
    }


    tableBody.innerHTML =
        routes.map(function (route, index) {

            return `
                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        📍 ${escapeHTML(route.source || "-")}
                    </td>

                    <td>
                        🏁 ${escapeHTML(route.destination || "-")}
                    </td>

                    <td>
                        <strong>
                            ${escapeHTML(route.algorithm || "-")}
                        </strong>
                    </td>

                    <td>
                        ${Number(route.distance || 0).toFixed(2)} km
                    </td>

                    <td>
                        ${formatDateTime(route.searched_at)}
                    </td>

                    <td>
                        <button
                            class="view-route-btn"
                            onclick="viewRoute(${route.route_id})"
                        >
                            <i class="fa-solid fa-eye"></i>
                            View
                        </button>
                    </td>

                </tr>
            `;

        }).join("");

}


/* ================= SUMMARY ================= */

function updateSummary(routes) {

    const totalRoutes =
        document.getElementById("totalRoutes");

    const totalDistance =
        document.getElementById("totalDistance");

    const mostUsedAlgorithm =
        document.getElementById("mostUsedAlgorithm");

    const latestSearch =
        document.getElementById("latestSearch");


    if (totalRoutes) {
        totalRoutes.textContent = routes.length;
    }


    let distance = 0;

    const algorithmCount = {};


    routes.forEach(function (route) {

        distance +=
            Number(route.distance || 0);


        const algorithm =
            route.algorithm || "Unknown";

        algorithmCount[algorithm] =
            (algorithmCount[algorithm] || 0) + 1;

    });


    if (totalDistance) {

        totalDistance.textContent =
            distance.toFixed(2) + " km";

    }


    let mostUsed = "—";

    let highest = 0;


    Object.keys(algorithmCount)
        .forEach(function (algorithm) {

            if (
                algorithmCount[algorithm] >
                highest
            ) {

                highest =
                    algorithmCount[algorithm];

                mostUsed =
                    algorithm;

            }

        });


    if (mostUsedAlgorithm) {
        mostUsedAlgorithm.textContent =
            mostUsed;
    }


    if (latestSearch) {

        if (
            routes.length > 0 &&
            routes[0].searched_at
        ) {

            latestSearch.textContent =
                formatShortDate(routes[0].searched_at);

        }
        else {

            latestSearch.textContent =
                "—";

        }

    }
}


/* ================= VIEW ================= */

function viewRoute(routeId) {

    console.log(
        "Selected route ID:",
        routeId
    );

    alert(
        "Route ID: " +
        routeId +
        "\n\nThis route is stored in MySQL."
    );
}


/* ================= CLEAR HISTORY ================= */

async function clearHistory() {

    const confirmed =
        confirm(
            "Are you sure you want to clear all route history?"
        );

    if (!confirmed) return;


    try {

        const response =
            await fetch(
                "/api/route-history",
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to clear history."
            );

        }


        await loadRouteHistory();


    }
    catch (error) {

        console.error(
            "Clear history error:",
            error
        );

        alert(
            "Unable to clear route history."
        );

    }

}


/* ================= EMPTY ================= */

function showEmptyState(message) {

    const tableBody =
        document.getElementById(
            "historyTableBody"
        );

    const empty =
        document.getElementById(
            "historyEmpty"
        );


    if (tableBody) {
        tableBody.innerHTML = "";
    }


    if (empty) {

        empty.style.display =
            "block";

        const text =
            empty.querySelector("p");

        if (text) {
            text.textContent = message;
        }

    }

}


/* ================= DATE ================= */

function formatDateTime(value) {

    if (!value) return "-";


    const date =
        new Date(value);


    if (isNaN(date.getTime())) {
        return "-";
    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


function formatShortDate(value) {

    if (!value) return "—";


    const date =
        new Date(value);


    if (isNaN(date.getTime())) {
        return "—";
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* ================= SECURITY ================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}