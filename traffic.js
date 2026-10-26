/* =========================================================
   SMART CITY ROUTE NAVIGATION
   REAL-TIME TRAFFIC STATUS
   ========================================================= */


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let trafficMap = null;

let trafficMarker = null;

let trafficLocation = null;

let trafficLayerGroup = null;

let lastTrafficData = null;


/* =========================================================
   DEFAULT MAP LOCATION
   ========================================================= */

const DEFAULT_LAT = 13.0827;
const DEFAULT_LON = 80.2707;


/* =========================================================
   INITIALIZE MAP
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    initializeTrafficMap();

    setupTrafficEvents();

});


/* =========================================================
   MAP INITIALIZATION
   ========================================================= */

function initializeTrafficMap() {

    trafficMap = L.map("trafficMap", {
        zoomControl: true
    }).setView(
        [DEFAULT_LAT, DEFAULT_LON],
        11
    );


    /* OpenStreetMap base map */

    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(trafficMap);


    /* Layer for traffic segments */

    trafficLayerGroup = L.layerGroup()
        .addTo(trafficMap);


    /* Initial marker */

    trafficMarker = L.marker([
        DEFAULT_LAT,
        DEFAULT_LON
    ]).addTo(trafficMap);


    trafficMarker.bindPopup(
        "<b>Traffic Monitoring</b><br>" +
        "Search a location to load live traffic."
    );


    setTimeout(function () {

        trafficMap.invalidateSize();

    }, 300);

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupTrafficEvents() {

    const searchButton =
        document.getElementById(
            "trafficSearchBtn"
        );


    const searchInput =
        document.getElementById(
            "trafficSearch"
        );


    const refreshButton =
        document.getElementById(
            "refreshTrafficBtn"
        );


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            searchTrafficLocation
        );

    }


    if (searchInput) {

        searchInput.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    searchTrafficLocation();

                }

            }
        );

    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            refreshTraffic
        );

    }

}


/* =========================================================
   SEARCH LOCATION
   ========================================================= */

async function searchTrafficLocation() {

    const input =
        document.getElementById(
            "trafficSearch"
        );


    if (!input) {
        return;
    }


    const place =
        input.value.trim();


    if (!place) {

        showTrafficMessage(
            "Please enter a location."
        );

        input.focus();

        return;
    }


    showMapLoading(true);


    try {

        /*
         * Use our Flask backend.
         *
         * Flask will communicate with
         * the geocoding service.
         */

        const response = await fetch(
            "/api/geocode?" +
            new URLSearchParams({
                q: place
            }),
            {
                headers: {
                    "Accept":
                        "application/json"
                },

                credentials:
                    "same-origin"
            }
        );


        if (!response.ok) {

            throw new Error(
                "Location search failed."
            );

        }


        const data =
            await response.json();


        if (
    !data ||
    typeof data.lat !== "number" ||
    typeof data.lon !== "number"
) {

    throw new Error(
        "Location not found."
    );

}

trafficLocation = {
    lat: data.lat,
    lon: data.lon,
    displayName: data.displayName || "Selected Location"
};


        updateLocationUI(
            trafficLocation
        );


        moveMapToLocation(
            trafficLocation
        );


        /*
         * After finding the location,
         * request REAL traffic information
         * from Flask.
         */

        await loadRealTraffic(
            trafficLocation.lat,
            trafficLocation.lon
        );


    } catch (error) {

        console.error(
            "Traffic search error:",
            error
        );


        showTrafficMessage(
            error.message ||
            "Unable to search location."
        );

    } finally {

        showMapLoading(false);

    }

}


/* =========================================================
   MOVE MAP
   ========================================================= */

function moveMapToLocation(location) {

    const lat =
        Number(location.lat);

    const lon =
        Number(location.lon);


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
    ) {

        return;

    }


    trafficMap.setView(
        [lat, lon],
        13,
        {
            animate: true
        }
    );


    if (trafficMarker) {

        trafficMap.removeLayer(
            trafficMarker
        );

    }


    trafficMarker =
        L.marker([lat, lon])
            .addTo(trafficMap);


    trafficMarker.bindPopup(
        "<b>" +
        escapeHtml(
            location.display_name ||
            "Selected Location"
        ) +
        "</b>"
    ).openPopup();

}


/* =========================================================
   UPDATE LOCATION INFORMATION
   ========================================================= */

function updateLocationUI(location) {

    const placeElement =
        document.getElementById(
            "searchedPlace"
        );


    const latElement =
        document.getElementById(
            "searchedLat"
        );


    const lonElement =
        document.getElementById(
            "searchedLon"
        );


    const statusLocation =
        document.getElementById(
            "trafficStatusMessage"
        );


    if (placeElement) {

        placeElement.textContent =
            location.display_name ||
            location.name ||
            "Selected location";

    }


    if (latElement) {

        latElement.textContent =
            Number(location.lat)
                .toFixed(6);

    }


    if (lonElement) {

        lonElement.textContent =
            Number(location.lon)
                .toFixed(6);

    }


    if (statusLocation) {

        statusLocation.textContent =
            "Loading live traffic...";

    }

}


/* =========================================================
   REAL TRAFFIC REQUEST
   ========================================================= */

async function loadRealTraffic(
    lat,
    lon
) {

    setTrafficLoadingState();


    try {

        const response = await fetch(
            "/api/traffic?" +
            new URLSearchParams({
                lat: lat,
                lon: lon
            }),
            {
                headers: {
                    "Accept":
                        "application/json"
                },

                credentials:
                    "same-origin"
            }
        );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Live traffic data unavailable."
            );

        }


        lastTrafficData = data;


        updateTrafficUI(data);


        drawTrafficSegments(data);


    } catch (error) {

        console.error(
            "Traffic API error:",
            error
        );


        showTrafficUnavailable(
            error.message
        );

    }

}


/* =========================================================
   REFRESH TRAFFIC
   ========================================================= */

async function refreshTraffic() {

    if (!trafficLocation) {

        showTrafficMessage(
            "Search a location first."
        );

        return;

    }


    showMapLoading(true);


    try {

        await loadRealTraffic(
            trafficLocation.lat,
            trafficLocation.lon
        );

    } finally {

        showMapLoading(false);

    }

}

/* =========================================================
    UPDATE TRAFFIC UI
    ========================================================= */

function updateTrafficUI(data) {

    const currentSpeed =
        Number(data.current_speed);

    const freeFlowSpeed =
        Number(data.free_flow_speed);


    let congestion =
        Number(data.congestion);


    if (
        !Number.isFinite(congestion) &&
        Number.isFinite(currentSpeed) &&
        Number.isFinite(freeFlowSpeed) &&
        freeFlowSpeed > 0
    ) {

        congestion =
            Math.max(
                0,
                (1 - currentSpeed / freeFlowSpeed) * 100
            );

    }


    let status =
        data.status ||
        getTrafficStatus(congestion);


    const currentTrafficStatus =
        document.getElementById(
            "currentTrafficStatus"
        );

    const currentSpeedElement =
        document.getElementById(
            "currentSpeed"
        );

    const freeFlowElement =
        document.getElementById(
            "freeFlowSpeed"
        );

    const lastUpdated =
        document.getElementById(
            "lastUpdated"
        );

    const statusMessage =
        document.getElementById(
            "trafficStatusMessage"
        );

    const roadCondition =
        document.getElementById(
            "roadCondition"
        );

    const roadConditionMessage =
        document.getElementById(
            "roadConditionMessage"
        );

    const congestionLevel =
        document.getElementById(
            "congestionLevel"
        );

    const roadSpeed =
        document.getElementById(
            "roadSpeed"
        );

    const trafficAlert =
        document.getElementById(
            "trafficAlertMessage"
        );

    const apiStatus =
        document.getElementById(
            "trafficApiStatus"
        );


    /* Current traffic */

    if (currentTrafficStatus) {

        currentTrafficStatus.textContent =
            status;

        currentTrafficStatus.style.color =
            getTrafficColor(status);

    }


    /* Current speed */

    if (currentSpeedElement) {

        currentSpeedElement.textContent =
            formatSpeed(
                currentSpeed
            );

    }


    /* Free flow speed */

    if (freeFlowElement) {

        freeFlowElement.textContent =
            formatSpeed(
                freeFlowSpeed
            );

    }


    /* Last updated */

    if (lastUpdated) {

        lastUpdated.textContent =
            formatTime(
                data.updated_at
            );

    }


    /* Status message */

    if (statusMessage) {

        statusMessage.textContent =
            getStatusMessage(status);

    }


    /* Road condition */

    if (roadCondition) {

        roadCondition.textContent =
            getRoadCondition(status);

        roadCondition.style.color =
            getTrafficColor(status);

    }


    if (roadConditionMessage) {

        roadConditionMessage.textContent =
            getStatusMessage(status);

    }


    /* Congestion */

    if (congestionLevel) {

        if (Number.isFinite(congestion)) {

            congestionLevel.textContent =
                Math.round(congestion) +
                "%";

        } else {

            congestionLevel.textContent =
                "—";

        }

    }


    /* Road speed */

    if (roadSpeed) {

        roadSpeed.textContent =
            formatSpeed(
                currentSpeed
            );

    }


    /* Alert */

    if (trafficAlert) {

        trafficAlert.textContent =
            getTrafficAlert(status);

    }


    /* API status */

    if (apiStatus) {

        apiStatus.textContent =
            "LIVE";

        apiStatus.style.background =
            "#ecfdf5";

        apiStatus.style.color =
            "#15803d";

    }

}


/* =========================================================
   TRAFFIC STATUS CALCULATION
   ========================================================= */

function getTrafficStatus(
    congestion
) {

    if (!Number.isFinite(congestion)) {

        return "Unknown";

    }


    /*
     * 0 - 25%:
     * Low traffic
     */

    if (congestion <= 25) {

        return "Low";

    }


    /*
     * 25 - 60%:
     * Moderate traffic
     */

    if (congestion <= 60) {

        return "Moderate";

    }


    /*
     * Above 60%:
     * Heavy traffic
     */

    return "Heavy";

}


/* =========================================================
   TRAFFIC COLORS
   ========================================================= */

function getTrafficColor(status) {

    const value =
        String(status)
            .toLowerCase();


    if (value === "low") {

        return "#16a34a";

    }


    if (value === "moderate") {

        return "#ea580c";

    }


    if (value === "heavy") {

        return "#dc2626";

    }


    return "#667085";

}


/* =========================================================
   TRAFFIC STATUS MESSAGE
   ========================================================= */

function getStatusMessage(status) {

    const value =
        String(status)
            .toLowerCase();


    if (value === "low") {

        return "Traffic is moving freely.";

    }


    if (value === "moderate") {

        return "Some congestion is present.";

    }


    if (value === "heavy") {

        return "Heavy congestion detected.";

    }


    return "Traffic condition is unavailable.";

}


/* =========================================================
   ROAD CONDITION
   ========================================================= */

function getRoadCondition(status) {

    const value =
        String(status)
            .toLowerCase();


    if (value === "low") {

        return "Free Flow";

    }


    if (value === "moderate") {

        return "Slower Traffic";

    }


    if (value === "heavy") {

        return "Congested";

    }


    return "Unknown";

}


/* =========================================================
   TRAFFIC ALERT
   ========================================================= */

function getTrafficAlert(status) {

    const value =
        String(status)
            .toLowerCase();


    if (value === "low") {

        return "Traffic is currently flowing normally.";

    }


    if (value === "moderate") {

        return "Moderate congestion detected. Allow extra travel time.";

    }


    if (value === "heavy") {

        return "Heavy traffic detected. Consider an alternative route.";

    }


    return "Live traffic information is currently unavailable.";

}


/* =========================================================
   DRAW REAL TRAFFIC SEGMENTS
   ========================================================= */

function drawTrafficSegments(data) {

    if (!trafficLayerGroup) {
        return;
    }


    /*
     * Remove previous traffic lines.
     */

    trafficLayerGroup.clearLayers();


    /*
     * Backend should return:
     *
     * data.segments = [
     *   {
     *      coordinates: [
     *          [lat, lon],
     *          [lat, lon]
     *      ],
     *      current_speed: 40,
     *      free_flow_speed: 60,
     *      congestion: 33
     *   }
     * ]
     */


    if (
        !Array.isArray(data.segments) ||
        data.segments.length === 0
    ) {

        return;

    }


    data.segments.forEach(
        function (segment) {

            if (
                !segment.coordinates ||
                segment.coordinates.length < 2
            ) {

                return;

            }


            const congestion =
                Number(segment.congestion);


            const status =
                segment.status ||
                getTrafficStatus(
                    congestion
                );


            const color =
                getTrafficColor(status);


            const line =
                L.polyline(
                    segment.coordinates,
                    {
                        color: color,

                        weight: 7,

                        opacity: 0.9,

                        lineCap: "round",

                        lineJoin: "round"
                    }
                );


            const speed =
                formatSpeed(
                    Number(
                        segment.current_speed
                    )
                );


            const freeFlow =
                formatSpeed(
                    Number(
                        segment.free_flow_speed
                    )
                );


            const popup =
                "<div style='min-width:180px'>" +

                "<strong>Live Traffic</strong>" +

                "<br><br>" +

                "<b>Status:</b> " +
                escapeHtml(status) +

                "<br>" +

                "<b>Current Speed:</b> " +
                escapeHtml(speed) +

                "<br>" +

                "<b>Free Flow:</b> " +
                escapeHtml(freeFlow) +

                "<br>" +

                "<b>Congestion:</b> " +
                (
                    Number.isFinite(
                        congestion
                    )
                    ?
                    Math.round(congestion) + "%"
                    :
                    "—"
                ) +

                "</div>";


            line.bindPopup(popup);


            line.addTo(
                trafficLayerGroup
            );

        }
    );

}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setTrafficLoadingState() {

    const status =
        document.getElementById(
            "currentTrafficStatus"
        );


    const message =
        document.getElementById(
            "trafficStatusMessage"
        );


    if (status) {

        status.textContent =
            "Loading...";

        status.style.color =
            "#3155ff";

    }


    if (message) {

        message.textContent =
            "Fetching live traffic data...";

    }

}


/* =========================================================
   TRAFFIC UNAVAILABLE
   ========================================================= */

function showTrafficUnavailable(
    message
) {

    const status =
        document.getElementById(
            "currentTrafficStatus"
        );


    const statusMessage =
        document.getElementById(
            "trafficStatusMessage"
        );


    const apiStatus =
        document.getElementById(
            "trafficApiStatus"
        );


    if (status) {

        status.textContent =
            "Unavailable";

        status.style.color =
            "#dc2626";

    }


    if (statusMessage) {

        statusMessage.textContent =
            message ||
            "Live traffic data unavailable.";

    }


    if (apiStatus) {

        apiStatus.textContent =
            "OFFLINE";

        apiStatus.style.background =
            "#fef2f2";

        apiStatus.style.color =
            "#dc2626";

    }

}


/* =========================================================
   GENERAL MESSAGE
   ========================================================= */

function showTrafficMessage(
    message
) {

    const status =
        document.getElementById(
            "currentTrafficStatus"
        );


    const statusMessage =
        document.getElementById(
            "trafficStatusMessage"
        );


    if (status) {

        status.textContent =
            "Notice";

        status.style.color =
            "#3155ff";

    }


    if (statusMessage) {

        statusMessage.textContent =
            message;

    }

}


/* =========================================================
   MAP LOADING
   ========================================================= */

function showMapLoading(
    show
) {

    const loader =
        document.getElementById(
            "mapLoading"
        );


    if (!loader) {
        return;
    }


    if (show) {

        loader.classList.add(
            "show"
        );

    } else {

        loader.classList.remove(
            "show"
        );

    }

}


/* =========================================================
   SPEED FORMAT
   ========================================================= */

function formatSpeed(
    speed
) {

    if (
        !Number.isFinite(speed) ||
        speed < 0
    ) {

        return "—";

    }


    return Math.round(speed) +
        " km/h";

}


/* =========================================================
   TIME FORMAT
   ========================================================= */

function formatTime(
    value
) {

    if (!value) {

        return new Date()
            .toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
    value
) {

    return String(value)
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

