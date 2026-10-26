/* =========================================================
   SMART CITY ROUTE NAVIGATION
   REPORTS MODULE - PART 1
   Real MySQL Route History Data
========================================================= */

let routesPerDayChart = null;
let algorithmUsageChart = null;
let distanceAlgorithmChart = null;
let travelTimeChart = null;

let allReportRoutes = [];


/* =========================================================
   PAGE START
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    loadReports();

    const refreshButton =
        document.getElementById("refreshReportsBtn");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadReports
        );

    }


    const dateInput =
        document.getElementById("reportDate");

    if (dateInput) {

        dateInput.addEventListener(
            "change",
            loadReports
        );

    }

});


/* =========================================================
   LOAD REPORT DATA
========================================================= */

async function loadReports() {

    showReportStatus(
        "Loading real route data...",
        "loading"
    );

    try {

        const response =
            await fetch(
                "/api/route-history",
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    credentials: "same-origin"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load route history."
            );

        }


        if (
            !data ||
            data.success !== true ||
            !Array.isArray(data.routes)
        ) {

            throw new Error(
                "Invalid route history data received."
            );

        }


        allReportRoutes =
            normalizeRoutes(data.routes);


        const selectedDate =
            document
                .getElementById("reportDate")
                ?.value || "";


        let filteredRoutes =
            allReportRoutes;


        if (selectedDate) {

            filteredRoutes =
                allReportRoutes.filter(
                    function (route) {

                        return (
                            getDateOnly(
                                route.searchedAt
                            ) === selectedDate
                        );

                    }
                );

        }


        updateSummaryCards(
            filteredRoutes
        );


        updateRoutesPerDayChart(
            filteredRoutes
        );


        updateAlgorithmUsageChart(
            filteredRoutes
        );


        updateDistanceAlgorithmChart(
            filteredRoutes
        );


        updateTopRoutes(
            filteredRoutes
        );


        updateTravelTimeChart(
            filteredRoutes
        );


        if (selectedDate) {

            showReportStatus(
                "Showing report for " +
                formatDisplayDate(
                    selectedDate
                ) +
                ".",
                "success"
            );

        } else {

            showReportStatus(
                "Reports updated using real MySQL route data.",
                "success"
            );

        }


    } catch (error) {

        console.error(
            "Reports loading error:",
            error
        );


        allReportRoutes = [];


        updateSummaryCards([]);

        updateRoutesPerDayChart([]);

        updateAlgorithmUsageChart([]);

        updateDistanceAlgorithmChart([]);

        updateTopRoutes([]);

        updateTravelTimeChart([]);


        showReportStatus(
            error.message ||
            "Unable to load reports.",
            "error"
        );

    }

}


/* =========================================================
   NORMALIZE DATABASE DATA
========================================================= */

function normalizeRoutes(routes) {

    return routes.map(
        function (route) {

            const algorithm =
                normalizeAlgorithm(
                    route.algorithm ||
                    route.route_type ||
                    ""
                );


            const distance =
                Number(
                    route.distance ??
                    route.distance_km ??
                    0
                );


            const travelTime =
                Number(
                    route.travel_time ??
                    route.travelTime ??
                    0
                );


            const searchedAt =
                route.searched_at ||
                route.searchedAt ||
                route.date ||
                null;


            return {

                routeId:
                    route.route_id ??
                    route.id ??
                    null,

                source:
                    String(
                        route.source ||
                        "Unknown"
                    ),

                destination:
                    String(
                        route.destination ||
                        "Unknown"
                    ),

                algorithm:
                    algorithm,

                distance:
                    Number.isFinite(distance)
                        ? distance
                        : 0,

                travelTime:
                    Number.isFinite(travelTime)
                        ? travelTime
                        : 0,

                searchedAt:
                    searchedAt

            };

        }
    );

}


/* =========================================================
   ALGORITHM NORMALIZATION
========================================================= */

function normalizeAlgorithm(value) {

    const text =
        String(value || "")
            .trim()
            .toLowerCase();


    if (
        text === "a*" ||
        text === "astar" ||
        text === "a star" ||
        text.includes("a*")
    ) {

        return "A* Search";

    }


    if (
        text === "bfs" ||
        text.includes("breadth")
    ) {

        return "BFS";

    }


    if (
        text === "dfs" ||
        text.includes("depth")
    ) {

        return "DFS";

    }


    if (
        text === "best first" ||
        text === "best-first" ||
        text.includes("best first")
    ) {

        return "Best First Search";

    }


    return value
        ? String(value)
        : "Unknown";

}


/* =========================================================
   SUMMARY CARDS
========================================================= */

function updateSummaryCards(routes) {

    const totalRoutes =
        routes.length;


    const totalDistance =
        routes.reduce(
            function (sum, route) {

                return sum +
                    Number(
                        route.distance || 0
                    );

            },
            0
        );


    const totalTravelTime =
        routes.reduce(
            function (sum, route) {

                return sum +
                    Number(
                        route.travelTime || 0
                    );

            },
            0
        );


    const algorithmCounts = {};


    routes.forEach(
        function (route) {

            const algorithm =
                route.algorithm ||
                "Unknown";


            algorithmCounts[algorithm] =
                (
                    algorithmCounts[algorithm] ||
                    0
                ) + 1;

        }
    );


    let mostUsedAlgorithm = "—";

    let highestCount = 0;


    Object.keys(algorithmCounts)
        .forEach(
            function (algorithm) {

                if (
                    algorithmCounts[algorithm] >
                    highestCount
                ) {

                    highestCount =
                        algorithmCounts[algorithm];

                    mostUsedAlgorithm =
                        algorithm;

                }

            }
        );


    setText(
        "reportTotalRoutes",
        totalRoutes
    );


    setText(
        "reportTotalDistance",
        formatKilometers(
            totalDistance
        )
    );


    setText(
        "reportMostAlgorithm",
        mostUsedAlgorithm
    );


    setText(
        "reportAlgorithmNote",
        mostUsedAlgorithm === "—"
            ? "No route searches yet"
            : "Used " +
              highestCount +
              " time" +
              (
                  highestCount === 1
                      ? ""
                      : "s"
              )
    );


    setText(
        "reportTotalTime",
        formatTravelTime(
            totalTravelTime
        )
    );

}

/* =========================================================
   ROUTES PER DAY CHART
========================================================= */

function updateRoutesPerDayChart(routes) {

    const canvas =
        document.getElementById("routesPerDayChart");

    if (!canvas) return;

    if (routesPerDayChart) {
        routesPerDayChart.destroy();
    }

    const dailyCounts = {};

    routes.forEach(function (route) {

        const date =
            getDateOnly(route.searchedAt);

        if (!date) return;

        dailyCounts[date] =
            (dailyCounts[date] || 0) + 1;

    });

    const dates =
        Object.keys(dailyCounts).sort();

    const counts =
        dates.map(function (date) {
            return dailyCounts[date];
        });

    routesPerDayChart =
        new Chart(canvas, {

            type: "line",

            data: {

                labels:
                    dates.map(formatDisplayDate),

                datasets: [{
                    label: "Routes",

                    data: counts,

                    borderWidth: 3,

                    tension: 0.35,

                    fill: false,

                    pointRadius: 4,

                    pointHoverRadius: 6
                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: true
                    }

                },

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }

                    }

                }

            }

        });

}


/* =========================================================
   ALGORITHM USAGE CHART
========================================================= */

function updateAlgorithmUsageChart(routes) {

    const canvas =
        document.getElementById("algorithmUsageChart");

    if (!canvas) return;

    if (algorithmUsageChart) {
        algorithmUsageChart.destroy();
    }

    const allowedAlgorithms = [
        "A* Search",
        "BFS",
        "DFS",
        "Best First Search"
    ];

    const counts = {};

    allowedAlgorithms.forEach(function (algorithm) {
        counts[algorithm] = 0;
    });

    routes.forEach(function (route) {

        const algorithm =
            normalizeAlgorithm(
                route.algorithm
            );

        if (
            allowedAlgorithms.includes(
                algorithm
            )
        ) {

            counts[algorithm]++;

        }

    });

    algorithmUsageChart =
        new Chart(canvas, {

            type: "doughnut",

            data: {

                labels: allowedAlgorithms,

                datasets: [{

                    data:
                        allowedAlgorithms.map(
                            function (algorithm) {
                                return counts[algorithm];
                            }
                        ),

                    borderWidth: 2

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        position: "bottom"
                    }

                }

            }

        });

}


/* =========================================================
   DISTANCE BY ALGORITHM
========================================================= */

function updateDistanceAlgorithmChart(routes) {

    const canvas =
        document.getElementById(
            "distanceAlgorithmChart"
        );

    if (!canvas) return;

    if (distanceAlgorithmChart) {
        distanceAlgorithmChart.destroy();
    }

    const allowedAlgorithms = [
        "A* Search",
        "BFS",
        "DFS",
        "Best First Search"
    ];

    const distanceTotals = {};

    allowedAlgorithms.forEach(function (algorithm) {

        distanceTotals[algorithm] = 0;

    });


    routes.forEach(function (route) {

        const algorithm =
            normalizeAlgorithm(
                route.algorithm
            );

        if (
            allowedAlgorithms.includes(
                algorithm
            )
        ) {

            distanceTotals[algorithm] +=
                Number(
                    route.distance || 0
                );

        }

    });


    distanceAlgorithmChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: allowedAlgorithms,

                datasets: [{

                    label: "Distance (km)",

                    data:
                        allowedAlgorithms.map(
                            function (algorithm) {
                                return Number(
                                    distanceTotals[algorithm]
                                        .toFixed(2)
                                );
                            }
                        ),

                    borderWidth: 1

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: true
                    }

                },

                scales: {

                    y: {

                        beginAtZero: true,

                        title: {
                            display: true,
                            text: "Kilometers"
                        }

                    }

                }

            }

        });

}


/* =========================================================
   TOP ROUTES TABLE
========================================================= */

function updateTopRoutes(routes) {

    const tableBody =
        document.getElementById(
            "topRoutesBody"
        );

    if (!tableBody) return;


    tableBody.innerHTML = "";


    if (!routes.length) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5"
                    style="text-align:center;padding:25px;">
                    No route data available.
                </td>
            </tr>
        `;

        return;

    }


    const sortedRoutes =
        [...routes].sort(
            function (a, b) {

                return (
                    Number(b.distance || 0) -
                    Number(a.distance || 0)
                );

            }
        );


    const topRoutes =
        sortedRoutes.slice(0, 10);


    topRoutes.forEach(function (route) {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHtml(
                    route.source
                )}
            </td>

            <td>
                ${escapeHtml(
                    route.destination
                )}
            </td>

            <td>
                ${escapeHtml(
                    route.algorithm
                )}
            </td>

            <td>
                ${formatKilometers(
                    route.distance
                )}
            </td>

            <td>
                ${formatTravelTime(
                    route.travelTime
                )}
            </td>

        `;


        tableBody.appendChild(row);

    });

}


/* =========================================================
   TRAVEL TIME CHART
========================================================= */

function updateTravelTimeChart(routes) {

    const canvas =
        document.getElementById(
            "travelTimeChart"
        );

    if (!canvas) return;

    if (travelTimeChart) {
        travelTimeChart.destroy();
    }


    const allowedAlgorithms = [
        "A* Search",
        "BFS",
        "DFS",
        "Best First Search"
    ];


    const timeTotals = {};

    const timeCounts = {};


    allowedAlgorithms.forEach(
        function (algorithm) {

            timeTotals[algorithm] = 0;
            timeCounts[algorithm] = 0;

        }
    );


    routes.forEach(function (route) {

        const algorithm =
            normalizeAlgorithm(
                route.algorithm
            );


        if (
            allowedAlgorithms.includes(
                algorithm
            )
        ) {

            timeTotals[algorithm] +=
                Number(
                    route.travelTime || 0
                );

            timeCounts[algorithm]++;

        }

    });


    const averageTimes =
        allowedAlgorithms.map(
            function (algorithm) {

                if (
                    timeCounts[algorithm] === 0
                ) {
                    return 0;
                }

                return Number(
                    (
                        timeTotals[algorithm] /
                        timeCounts[algorithm]
                    ).toFixed(2)
                );

            }
        );


    travelTimeChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: allowedAlgorithms,

                datasets: [{

                    label:
                        "Average Travel Time (min)",

                    data: averageTimes,

                    borderWidth: 1

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: true
                    }

                },

                scales: {

                    y: {

                        beginAtZero: true,

                        title: {
                            display: true,
                            text: "Minutes"
                        }

                    }

                }

            }

        });

}


/* =========================================================
   COMMON HELPERS
========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;

    }

}


function formatKilometers(value) {

    const number =
        Number(value || 0);

    return (
        number.toFixed(2) +
        " km"
    );

}


function formatTravelTime(minutes) {

    const totalMinutes =
        Math.round(
            Number(minutes || 0)
        );


    if (totalMinutes <= 0) {
        return "0 min";
    }


    const hours =
        Math.floor(
            totalMinutes / 60
        );


    const remainingMinutes =
        totalMinutes % 60;


    if (hours > 0) {

        return (
            hours +
            " hr " +
            remainingMinutes +
            " min"
        );

    }


    return (
        remainingMinutes +
        " min"
    );

}


/* =========================================================
   DATE HELPERS
========================================================= */

function getDateOnly(value) {

    if (!value) {
        return "";
    }


    const text =
        String(value);


    if (
        /^\d{4}-\d{2}-\d{2}/.test(text)
    ) {

        return text.substring(
            0,
            10
        );

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
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


function formatDisplayDate(value) {

    if (!value) {
        return "—";
    }


    const parts =
        String(value).split("-");


    if (parts.length !== 3) {
        return String(value);
    }


    return (
        parts[2] +
        "/" +
        parts[1] +
        "/" +
        parts[0]
    );

}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   REPORT STATUS
========================================================= */

function showReportStatus(
    message,
    type
) {

    const status =
        document.getElementById(
            "reportStatus"
        );


    if (!status) return;


    status.textContent =
        message;


    status.className =
        "report-status " +
        (
            type ||
            "info"
        );

}