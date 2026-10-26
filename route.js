/* =========================================================
   SMART CITY ROUTE NAVIGATION
   route.js
   ========================================================= */


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let routeMap = null;

let startMarker = null;
let destinationMarker = null;
let routeLine = null;

let startCoordinates = null;
let destinationCoordinates = null;

let startPlaceName = "";
let destinationPlaceName = "";


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    initializeRouteMap();
    loadSavedLocations();

});


/* =========================================================
   INITIALIZE LEAFLET MAP
   ========================================================= */

function initializeRouteMap() {

    const mapElement =
        document.getElementById("routeMap");

    if (!mapElement) {
        console.error("routeMap element not found.");
        return;
    }

    routeMap = L.map("routeMap").setView(
        [14.4674, 78.8241],
        12
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(routeMap);

    setTimeout(function () {
        routeMap.invalidateSize();
    }, 300);
}


/* =========================================================
   LOAD SAVED LOCATIONS
   ========================================================= */

function loadSavedLocations() {

    const savedStart =
        localStorage.getItem("routeStart");

    const savedDestination =
        localStorage.getItem("routeDestination");

    const startInput =
        document.getElementById("startLocation");

    const destinationInput =
        document.getElementById("destinationLocation");

    if (savedStart && startInput) {
        startInput.value = savedStart;
    }

    if (savedDestination && destinationInput) {
        destinationInput.value = savedDestination;
    }
}


/* =========================================================
   GEOCODE LOCATION
   ========================================================= */

async function geocodeLocation(place) {

    if (!place || place.trim() === "") {
        throw new Error("Please enter a location.");
    }

    const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json" +
        "&q=" +
        encodeURIComponent(place) +
        "&limit=1" +
        "&countrycodes=in";

    const response =
        await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

    if (!response.ok) {
        throw new Error("Location search failed.");
    }

    const data =
        await response.json();

    if (!data || data.length === 0) {
        throw new Error(
            "Location not found: " + place
        );
    }

    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
    };
}


/* =========================================================
   FIND BEST ROUTE
   ========================================================= */

async function findBestRoute() {

    const startInput =
        document.getElementById("startLocation");

    const destinationInput =
        document.getElementById("destinationLocation");

    const algorithmSelect =
        document.getElementById("algorithm");

    if (!startInput || !destinationInput) {
        alert("Route input fields are missing.");
        return;
    }

    const startText =
        startInput.value.trim();

    const destinationText =
        destinationInput.value.trim();

    if (!startText || !destinationText) {

        showStatus(
            "Please enter both start location and destination.",
            "error"
        );

        return;
    }

    if (
        startText.toLowerCase() ===
        destinationText.toLowerCase()
    ) {

        showStatus(
            "Start and destination cannot be the same.",
            "error"
        );

        return;
    }

    const algorithm =
        algorithmSelect
            ? algorithmSelect.value
            : "astar";

    showStatus(
        "Searching locations...",
        "loading"
    );

    try {

        /* -------------------------------------------------
           1. GEOCODE START
           ------------------------------------------------- */

        const start =
            await geocodeLocation(startText);

        showStatus(
            "Finding destination...",
            "loading"
        );


        /* -------------------------------------------------
           2. GEOCODE DESTINATION
           ------------------------------------------------- */

        const destination =
            await geocodeLocation(destinationText);

        startCoordinates = [
            start.lat,
            start.lon
        ];

        destinationCoordinates = [
            destination.lat,
            destination.lon
        ];

        startPlaceName =
            start.displayName;

        destinationPlaceName =
            destination.displayName;


        /* -------------------------------------------------
           SAVE LAST LOCATIONS
           ------------------------------------------------- */

        localStorage.setItem(
            "routeStart",
            startText
        );

        localStorage.setItem(
            "routeDestination",
            destinationText
        );


        /* -------------------------------------------------
           3. MARKERS
           ------------------------------------------------- */

        addStartMarker(
            start.lat,
            start.lon,
            start.displayName
        );

        addDestinationMarker(
            destination.lat,
            destination.lon,
            destination.displayName
        );


        /* -------------------------------------------------
           4. REAL ROAD ROUTE
           ------------------------------------------------- */

        showStatus(
            "Calculating road route...",
            "loading"
        );

        const routeData =
            await getRoadRoute(
                start.lon,
                start.lat,
                destination.lon,
                destination.lat
            );

        if (!routeData) {
            throw new Error(
                "Unable to calculate road route."
            );
        }


        /* -------------------------------------------------
           5. RUN SELECTED ALGORITHM
           ------------------------------------------------- */

        const algorithmResult =
            runSelectedAlgorithm(
                routeData.coordinates,
                algorithm
            );


        /* -------------------------------------------------
           6. DRAW ROUTE
           ------------------------------------------------- */

        drawRoute(
            algorithmResult.path
        );


        /* -------------------------------------------------
           7. UPDATE SUMMARY
           ------------------------------------------------- */

        updateRouteSummary(
            routeData,
            algorithm
        );


        /* -------------------------------------------------
           8. SHOW ROUTE STEPS
           ------------------------------------------------- */

        showRouteSteps(
            routeData.steps
        );


        /* -------------------------------------------------
           9. UPDATE LOCATION LABELS
           ------------------------------------------------- */

        updateLocationLabels(
            start.displayName,
            destination.displayName
        );


        /* -------------------------------------------------
           10. SAVE ROUTE TO HISTORY
           ------------------------------------------------- */

        saveRouteHistorySafe({
    source: startText,
    destination: destinationText,

    sourceLat: start.lat,
    sourceLon: start.lon,

    destinationLat: destination.lat,
    destinationLon: destination.lon,

    distanceKm:
        Number(routeData.distance || 0) / 1000,

    travelTime:
        Math.round(
            Number(routeData.duration || 0) / 60
        ),

    algorithm:
        getAlgorithmName(algorithm),

    timestamp:
        new Date().toISOString()
});


        /* -------------------------------------------------
           SUCCESS
           ------------------------------------------------- */

        showStatus(
            "Best route found successfully.",
            "success"
        );

    }
    catch (error) {

        console.error(error);

        showStatus(
            error.message ||
            "Unable to calculate route.",
            "error"
        );

    }
}


/* =========================================================
   GET REAL ROAD ROUTE - OSRM
   ========================================================= */

async function getRoadRoute(
    startLon,
    startLat,
    destinationLon,
    destinationLat
) {

    const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        startLon +
        "," +
        startLat +
        ";" +
        destinationLon +
        "," +
        destinationLat +
        "?overview=full" +
        "&geometries=geojson" +
        "&steps=true";

    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error(
            "Routing service unavailable."
        );
    }

    const data =
        await response.json();

    if (
        data.code !== "Ok" ||
        !data.routes ||
        data.routes.length === 0
    ) {

        throw new Error(
            "No road route found."
        );
    }

    const route =
        data.routes[0];

    const coordinates =
        route.geometry.coordinates.map(
            function (point) {

                return [
                    point[1],
                    point[0]
                ];

            }
        );

    const steps = [];

    if (route.legs) {

        route.legs.forEach(
            function (leg) {

                if (leg.steps) {

                    leg.steps.forEach(
                        function (step) {

                            if (
                                step.name ||
                                step.maneuver
                            ) {

                                steps.push({

                                    instruction:
                                        createInstruction(step),

                                    distance:
                                        step.distance,

                                    duration:
                                        step.duration

                                });

                            }

                        }
                    );

                }

            }
        );

    }

    return {

        distance:
            route.distance,

        duration:
            route.duration,

        coordinates:
            coordinates,

        steps:
            steps

    };
}


/* =========================================================
   CREATE ROUTE INSTRUCTION
   ========================================================= */

function createInstruction(step) {

    let instruction = "";

    if (
        step.maneuver &&
        step.maneuver.type
    ) {

        const type =
            step.maneuver.type;

        switch (type) {

            case "depart":
                instruction = "Start";
                break;

            case "arrive":
                instruction =
                    "You have arrived";
                break;

            case "turn":
                instruction =
                    "Turn " +
                    (step.maneuver.modifier || "");
                break;

            case "merge":
                instruction = "Merge";
                break;

            case "roundabout":
                instruction =
                    "Enter roundabout";
                break;

            case "new name":
                instruction =
                    "Continue";
                break;

            default:
                instruction =
                    "Continue";

        }

    }
    else {

        instruction =
            "Continue";

    }

    if (step.name) {

        instruction +=
            " onto " +
            step.name;

    }

    return instruction;
}


/* =========================================================
   ADD START MARKER
   ========================================================= */

function addStartMarker(
    lat,
    lon,
    name
) {

    if (startMarker) {
        routeMap.removeLayer(startMarker);
    }

    const startIcon =
        L.divIcon({

            className:
                "custom-map-marker",

            html:
                '<div style="' +
                'width:18px;' +
                'height:18px;' +
                'background:#20c997;' +
                'border:3px solid white;' +
                'border-radius:50%;' +
                'box-shadow:0 2px 8px rgba(0,0,0,.4);' +
                '"></div>',

            iconSize: [
                18,
                18
            ],

            iconAnchor: [
                9,
                9
            ]

        });

    startMarker =
        L.marker(
            [lat, lon],
            {
                icon: startIcon
            }
        )
        .addTo(routeMap)
        .bindPopup(
            "<b>📍 Start Location</b><br>" +
            name
        );
}


/* =========================================================
   ADD DESTINATION MARKER
   ========================================================= */

function addDestinationMarker(
    lat,
    lon,
    name
) {

    if (destinationMarker) {
        routeMap.removeLayer(
            destinationMarker
        );
    }

    const destinationIcon =
        L.divIcon({

            className:
                "custom-map-marker",

            html:
                '<div style="' +
                'width:18px;' +
                'height:18px;' +
                'background:#ff4757;' +
                'border:3px solid white;' +
                'border-radius:50%;' +
                'box-shadow:0 2px 8px rgba(0,0,0,.4);' +
                '"></div>',

            iconSize: [
                18,
                18
            ],

            iconAnchor: [
                9,
                9
            ]

        });

    destinationMarker =
        L.marker(
            [lat, lon],
            {
                icon:
                    destinationIcon
            }
        )
        .addTo(routeMap)
        .bindPopup(
            "<b>🏁 Destination</b><br>" +
            name
        );
}


/* =========================================================
   DRAW ROUTE
   ========================================================= */

function drawRoute(path) {

    if (
        !routeMap ||
        !path ||
        path.length === 0
    ) {
        return;
    }

    if (routeLine) {

        routeMap.removeLayer(
            routeLine
        );

    }

    routeLine =
        L.polyline(
            path,
            {
                color: "#3155ff",
                weight: 6,
                opacity: 0.85
            }
        ).addTo(routeMap);

    const bounds =
        routeLine.getBounds();

    routeMap.fitBounds(
        bounds,
        {
            padding: [
                40,
                40
            ]
        }
    );
}


/* =========================================================
   UPDATE LOCATION LABELS
   ========================================================= */

function updateLocationLabels(
    start,
    destination
) {

    const startElement =
        document.getElementById(
            "startLocation"
        );

    const destinationElement =
        document.getElementById(
            "destinationLocation"
        );

    if (startElement) {
        startElement.value =
            startElement.value;
    }

    if (destinationElement) {
        destinationElement.value =
            destinationElement.value;
    }
}


/* =========================================================
   UPDATE ROUTE SUMMARY
   ========================================================= */

function updateRouteSummary(
    routeData,
    algorithm
) {

    const distanceElement =
        document.getElementById(
            "routeDistance"
        );

    const timeElement =
        document.getElementById(
            "routeTime"
        );

    const tollElement =
        document.getElementById(
            "routeToll"
        );

    const trafficElement =
        document.getElementById(
            "routeTraffic"
        );

    const distanceKm =
        routeData.distance / 1000;

    const minutes =
        Math.round(
            routeData.duration / 60
        );

    if (distanceElement) {

        distanceElement.textContent =
            distanceKm.toFixed(2) +
            " km";

    }

    if (timeElement) {

        timeElement.textContent =
            formatDuration(minutes);

    }

    /*
       OpenStreetMap/OSRM does not provide
       actual toll prices.
    */

    if (tollElement) {

        tollElement.textContent =
            "Not available";

    }

    /*
       Real-time traffic is not supplied
       by OSRM.
    */

    if (trafficElement) {

        trafficElement.textContent =
            "Normal";

    }

    const algorithmName =
        getAlgorithmName(
            algorithm
        );

    const status =
        document.getElementById(
            "routeStatus"
        );

    if (status) {

        status.innerHTML =
            "<strong>✓ Route Found</strong><br>" +
            algorithmName +
            " selected • " +
            distanceKm.toFixed(2) +
            " km • " +
            formatDuration(minutes);

    }
}


/* =========================================================
   FORMAT DURATION
   ========================================================= */

function formatDuration(minutes) {

    if (minutes < 60) {

        return minutes +
            " min";

    }

    const hours =
        Math.floor(
            minutes / 60
        );

    const remaining =
        minutes % 60;

    if (remaining === 0) {

        return hours +
            " hr";

    }

    return (
        hours +
        " hr " +
        remaining +
        " min"
    );
}


/* =========================================================
   GET ALGORITHM NAME
   ========================================================= */

function getAlgorithmName(
    algorithm
) {

    switch (algorithm) {

        case "bfs":
            return "BFS";

        case "dfs":
            return "DFS";

        case "best-first":
            return "Best First Search";

        case "astar":
            return "A* Search";

        default:
            return "A* Search";

    }
}

/* =========================================================
   CREATE GRAPH
   ========================================================= */

function createGraph(coordinates) {

    const graph = [];

    // Create every node
    for (let i = 0; i < coordinates.length; i++) {

        graph.push({
            index: i,
            point: coordinates[i],
            neighbors: []
        });

    }

    // Connect neighbouring nodes
    for (let i = 0; i < graph.length - 1; i++) {

        graph[i].neighbors.push(i + 1);

        graph[i + 1].neighbors.push(i);

    }

    return graph;
}

    

/* =========================================================
   POINT DISTANCE
   ========================================================= */

function pointDistance(
    a,
    b
) {

    const dx =
        a[0] - b[0];

    const dy =
        a[1] - b[1];

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* =========================================================
   BFS
   ========================================================= */

function bfs(
    graph,
    start,
    goal
) {

    const queue = [
        start
    ];

    const visited =
        new Set([
            start
        ]);

    const parent = {};

    while (
        queue.length > 0
    ) {

        const current =
            queue.shift();

        if (
            current === goal
        ) {

            break;

        }

        graph[current]
            .neighbors
            .forEach(
                function (neighbor) {

                    if (
                        !visited.has(
                            neighbor
                        )
                    ) {

                        visited.add(
                            neighbor
                        );

                        parent[neighbor] =
                            current;

                        queue.push(
                            neighbor
                        );

                    }

                }
            );

    }

    return reconstructPath(
        parent,
        start,
        goal
    );
}


/* =========================================================
   DFS
   ========================================================= */

function dfs(
    graph,
    start,
    goal
) {

    const stack = [
        start
    ];

    const visited =
        new Set();

    const parent = {};

    while (
        stack.length > 0
    ) {

        const current =
            stack.pop();

        if (
            visited.has(
                current
            )
        ) {

            continue;

        }

        visited.add(
            current
        );

        if (
            current === goal
        ) {

            break;

        }

        const neighbors =
            graph[current]
                .neighbors;

        for (
            let i =
                neighbors.length - 1;
            i >= 0;
            i--
        ) {

            const neighbor =
                neighbors[i];

            if (
                !visited.has(
                    neighbor
                )
            ) {

                parent[neighbor] =
                    current;

                stack.push(
                    neighbor
                );

            }

        }

    }

    return reconstructPath(
        parent,
        start,
        goal
    );
}


/* =========================================================
   BEST FIRST SEARCH
   ========================================================= */

function bestFirstSearch(
    graph,
    start,
    goal
) {

    const open = [
        start
    ];

    const visited =
        new Set();

    const parent = {};

    while (
        open.length > 0
    ) {

        open.sort(
            function (a, b) {

                return (
                    pointDistance(
                        graph[a].point,
                        graph[goal].point
                    ) -
                    pointDistance(
                        graph[b].point,
                        graph[goal].point
                    )
                );

            }
        );

        const current =
            open.shift();

        if (
            visited.has(
                current
            )
        ) {

            continue;

        }

        visited.add(
            current
        );

        if (
            current === goal
        ) {

            break;

        }

        graph[current]
            .neighbors
            .forEach(
                function (neighbor) {

                    if (
                        !visited.has(
                            neighbor
                        )
                    ) {

                        parent[neighbor] =
                            current;

                        open.push(
                            neighbor
                        );

                    }

                }
            );

    }

    return reconstructPath(
        parent,
        start,
        goal
    );
}


/* =========================================================
   A* SEARCH
   ========================================================= */

function aStarSearch(
    graph,
    start,
    goal
) {

    const open = [
        start
    ];

    const closed =
        new Set();

    const parent = {};

    const gScore = {};

    const fScore = {};

    graph.forEach(
        function (node) {

            gScore[node.index] =
                Infinity;

            fScore[node.index] =
                Infinity;

        }
    );

    gScore[start] = 0;

    fScore[start] =
        pointDistance(
            graph[start].point,
            graph[goal].point
        );

    while (
        open.length > 0
    ) {

        open.sort(
            function (a, b) {

                return (
                    fScore[a] -
                    fScore[b]
                );

            }
        );

        const current =
            open.shift();

        if (
            current === goal
        ) {

            break;

        }

        closed.add(
            current
        );

        graph[current]
            .neighbors
            .forEach(
                function (neighbor) {

                    if (
                        closed.has(
                            neighbor
                        )
                    ) {

                        return;

                    }

                    const tentativeG =
                        gScore[current] +
                        pointDistance(
                            graph[current]
                                .point,
                            graph[neighbor]
                                .point
                        );

                    if (
                        tentativeG <
                        gScore[neighbor]
                    ) {

                        parent[neighbor] =
                            current;

                        gScore[neighbor] =
                            tentativeG;

                        fScore[neighbor] =
                            tentativeG +
                            pointDistance(
                                graph[neighbor]
                                    .point,
                                graph[goal]
                                    .point
                            );

                        if (
                            !open.includes(
                                neighbor
                            )
                        ) {

                            open.push(
                                neighbor
                            );

                        }

                    }

                }
            );

    }

    return reconstructPath(
        parent,
        start,
        goal
    );
}

/* =========================================================
   RECONSTRUCT PATH
   ========================================================= */

function reconstructPath(
    parent,
    start,
    goal
) {

    const path = [];

    let current =
        goal;

    /*
       If there is no parent and
       start != goal, no path was found.
    */

    if (
        current !== start &&
        parent[current] === undefined
    ) {

        return [];

    }

    while (
        current !== undefined
    ) {

        path.unshift(
            current
        );

        if (
            current === start
        ) {

            break;

        }

        current =
            parent[current];

    }

    if (
        path[0] !== start
    ) {

        return [];

    }

    return path;
}


/* =========================================================
   RUN SELECTED ALGORITHM
   ========================================================= */

function runSelectedAlgorithm(
    coordinates,
    algorithm
) {

    const graph =
        createGraph(
            coordinates
        );

    const start =
        0;

    const goal =
        graph.length - 1;

    let indexes = [];


    switch (algorithm) {

        case "bfs":

            indexes =
                bfs(
                    graph,
                    start,
                    goal
                );

            break;


        case "dfs":

            indexes =
                dfs(
                    graph,
                    start,
                    goal
                );

            break;


        case "best-first":

            indexes =
                bestFirstSearch(
                    graph,
                    start,
                    goal
                );

            break;


        case "astar":

            indexes =
                aStarSearch(
                    graph,
                    start,
                    goal
                );

            break;


        default:

            indexes =
                aStarSearch(
                    graph,
                    start,
                    goal
                );

    }


    /*
       Safety fallback.
       If the selected graph search cannot
       produce a path, use the actual OSRM
       road path instead of showing a blank map.
    */

    if (
        !indexes ||
        indexes.length === 0
    ) {

        return {

            path:
                coordinates,

            algorithm:
                algorithm

        };

    }


    const path =
        indexes.map(
            function (index) {

                return coordinates[
                    index
                ];

            }
        );


    return {

        path:
            path,

        algorithm:
            algorithm

    };
}


/* =========================================================
   SHOW ROUTE STEPS
   ========================================================= */

function showRouteSteps(
    steps
) {

    const container =
        document.getElementById(
            "routeSteps"
        );

    if (!container) {
        return;
    }

    if (
        !steps ||
        steps.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-route">

                <div class="empty-route-icon">
                    🧭
                </div>

                <h3>
                    Route Calculated
                </h3>

                <p>
                    Follow the highlighted route
                    on the map.
                </p>

            </div>

        `;

        return;

    }


    /*
       Limit the number of displayed
       instructions so the page stays clean.
    */

    const visibleSteps =
        steps.slice(
            0,
            20
        );


    let html = "";


    visibleSteps.forEach(
        function (step, index) {

            const distance =
                step.distance >= 1000
                    ? (
                        step.distance / 1000
                    ).toFixed(1) +
                      " km"
                    : Math.round(
                        step.distance
                    ) + " m";


            html += `

                <div class="route-step-card">

                    <div class="step-number">
                        ${index + 1}
                    </div>

                    <div class="step-content">

                        <h3>
                            ${step.instruction}
                        </h3>

                        <p>
                            ${distance}
                        </p>

                    </div>

                </div>

            `;

        }
    );


    container.innerHTML =
        html;
}


/* =========================================================
   STATUS MESSAGE
   ========================================================= */

function showStatus(
    message,
    type
) {

    const status =
        document.getElementById(
            "routeStatus"
        );

    if (!status) {
        return;
    }


    status.innerHTML =
        message;


    status.classList.remove(
        "success",
        "error",
        "loading"
    );


    if (type) {

        status.classList.add(
            type
        );

    }
}


/* =========================================================
   SAVE ROUTE TO HISTORY
   ========================================================= */

async function saveRouteHistorySafe(route) {

    // ==========================================
    // 1. SAVE IN BROWSER HISTORY
    // ==========================================

    try {

        let history = JSON.parse(
            localStorage.getItem("routeHistory") || "[]"
        );

        if (!Array.isArray(history)) {
            history = [];
        }

        history.unshift(route);

        history = history.slice(0, 50);

        localStorage.setItem(
            "routeHistory",
            JSON.stringify(history)
        );

    } catch (error) {

        console.warn(
            "Local history save failed:",
            error
        );
    }


    // ==========================================
    // 2. SAVE IN MYSQL
    // ==========================================

    try {

        const response = await fetch(
            "/api/route-history",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials: "same-origin",

                body: JSON.stringify({

                    source:
                        route.source,

                    destination:
                        route.destination,

                    sourceLat:
                        route.sourceLat,

                    sourceLon:
                        route.sourceLon,

                    destinationLat:
                        route.destinationLat,

                    destinationLon:
                        route.destinationLon,

                    distance:
                        route.distanceKm,

                    travelTime:
                        route.travelTime,

                    algorithm:
                        route.algorithm

                })
            }
        );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            console.warn(
                "MySQL route save failed:",
                data.message ||
                "Unknown error"
            );

            return;
        }


        console.log(
            "Route saved successfully to MySQL.",
            data
        );


    } catch (error) {

        console.warn(
            "MySQL route save error:",
            error
        );
    }
}

/* =========================================================
   CLEAR START LOCATION
   ========================================================= */

function clearStartLocation() {

    const input =
        document.getElementById(
            "startLocation"
        );

    if (input) {

        input.value = "";

        localStorage.removeItem(
            "routeStart"
        );

        input.focus();

    }
}


/* =========================================================
   CLEAR DESTINATION LOCATION
   ========================================================= */

function clearDestinationLocation() {

    const input =
        document.getElementById(
            "destinationLocation"
        );

    if (input) {

        input.value = "";

        localStorage.removeItem(
            "routeDestination"
        );

        input.focus();

    }
}


/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            (
                document.activeElement.id ===
                "startLocation" ||

                document.activeElement.id ===
                "destinationLocation"
            )
        ) {

            findBestRoute();

        }

    }
);