/* ========================================================= SMART CITY ROUTE FINDER Nominatim + OSRM + Leaflet + Turn-by-Turn + Voice ========================================================= */

let routeMap = null;
let startMarker = null;
let destinationMarker = null;
let routeLine = null;

let currentRoute = null;
let currentSteps = [];
let currentStart = null;
let currentDestination = null;

let voiceRunning = false;
let voiceIndex = 0;

document.addEventListener("DOMContentLoaded", function () {
  initializeRouteMap();
  setupRouteButton();
  setupEnterKey();
  setupMapTabs();
  setupVoiceNavigation();
});

/* ================= MAP ================= */

function initializeRouteMap() {
  const mapElement = document.getElementById("routeMap");

  if (!mapElement || typeof L === "undefined") {
    console.error("Leaflet or routeMap is missing.");
    return;
  }

  routeMap = L.map("routeMap", {
    zoomControl: true,
    scrollWheelZoom: true,
  }).setView([14.4674, 78.8241], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(routeMap);

  setTimeout(function () {
    routeMap.invalidateSize();
  }, 400);
}

function setupMapTabs() {
  const liveTab = document.getElementById("liveMapTab");
  const previewTab = document.getElementById("routePreviewTab");
  const livePanel = document.getElementById("liveMapPanel");
  const previewPanel = document.getElementById("routePreviewPanel");

  if (!liveTab || !previewTab) return;

  liveTab.addEventListener("click", function () {
    liveTab.classList.add("active");
    previewTab.classList.remove("active");

    livePanel.style.display = "block";
    previewPanel.style.display = "none";

    setTimeout(function () {
      if (routeMap) routeMap.invalidateSize();
    }, 150);
  });

  previewTab.addEventListener("click", function () {
    previewTab.classList.add("active");
    liveTab.classList.remove("active");

    livePanel.style.display = "none";
    previewPanel.style.display = "block";
  });
}

/* ================= BUTTON / ENTER ================= */

function setupRouteButton() {
  const button = document.getElementById("findRouteBtn");

  if (button) {
    button.addEventListener("click", findBestRoute);
  }
}

function setupEnterKey() {
  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Enter" &&
      (document.activeElement?.id === "startLocation" ||
        document.activeElement?.id === "destinationLocation")
    ) {
      event.preventDefault();
      findBestRoute();
    }
  });
}

/* ================= GEOCODING ================= */

async function geocodeLocation(place) {
  if (!place || !place.trim()) {
    throw new Error("Please enter a location.");
  }

  const response = await fetch(
    "/api/geocode?" +
      new URLSearchParams({
        q: place.trim(),
      }),
    {
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    }
  );

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.error || "Location search failed.");
  }

  if (data.lat === undefined || data.lon === undefined) {
    throw new Error("Location could not be found.");
  }

  return {
    lat: Number(data.lat),
    lon: Number(data.lon),
    displayName: data.displayName || data.display_name || place,
  };
}

/* ================= OSRM ================= */

async function getRoadRoutes(start, destination) {
  const response = await fetch(
    "/api/route?" +
      new URLSearchParams({
        start_lat: start.lat,
        start_lon: start.lon,
        dest_lat: destination.lat,
        dest_lon: destination.lon,
      }),
    {
      credentials: "same-origin",
    }
  );

  const data = await readJson(response);

  if (!response.ok || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error(data.error || "No road route was found.");
  }

  return data.routes;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error("The server returned an invalid response.");
  }
}

/* ================= ALGORITHM ================= */

function selectRoute(routes, algorithm) {
  if (!routes.length) return null;

  /* OSRM provides real road routes. The selected algorithm is used here to choose among available route alternatives for the project demonstration. It does NOT claim that OSRM itself executes BFS/DFS/A* over the complete road graph. */

  if (algorithm === "bfs") {
    return routes[0];
  }

  if (algorithm === "dfs") {
    return routes[routes.length - 1];
  }

  if (algorithm === "best-first") {
    return routes.reduce(function (best, current) {
      return Number(current.duration) < Number(best.duration) ? current : best;
    });
  }

  /* A* / default: shortest available road distance */

  return routes.reduce(function (best, current) {
    return Number(current.distance) < Number(best.distance) ? current : best;
  });
}

/* ================= PREPARE ROUTE ================= */

function prepareRoute(route) {
  if (!route || !route.geometry || !route.geometry.coordinates) {
    throw new Error("Invalid route data received.");
  }

  const coordinates = route.geometry.coordinates.map(function (point) {
    return [Number(point[1]), Number(point[0])];
  });

  const steps = [];

  (route.legs || []).forEach(function (leg) {
    (leg.steps || []).forEach(function (step) {
      steps.push({
        instruction: createInstruction(step),

        distance: Number(step.distance || 0),

        duration: Number(step.duration || 0),
      });
    });
  });

  return {
    coordinates: coordinates,
    distance: Number(route.distance || 0),
    duration: Number(route.duration || 0),
    steps: steps,
  };
}

function createInstruction(step) {
  const maneuver = step?.maneuver || {};

  const type = maneuver.type || "";

  const modifier = maneuver.modifier || "";

  const road = step.name?.trim() || "";

  let text = "Continue";

  switch (type) {
    case "depart":
      text = "Start your journey";
      break;

    case "arrive":
      text = "You have arrived at your destination";
      break;

    case "turn":
      text = modifier ? "Turn " + modifier : "Turn";
      break;

    case "continue":
      text = "Continue straight";
      break;

    case "merge":
      text = "Merge";
      break;

    case "fork":
      text = modifier ? "Take the " + modifier + " fork" : "Take the fork";
      break;

    case "roundabout":
    case "rotary":
      text = "Enter the roundabout";
      break;

    case "on ramp":
      text = "Take the ramp";
      break;

    case "off ramp":
      text = "Take the exit ramp";
      break;

    case "end of road":
      text = modifier
        ? "At the end of the road, turn " + modifier
        : "At the end of the road";
      break;

    case "new name":
      text = "Continue";
      break;

    default:
      text = "Continue";
  }

  if (road && type !== "arrive" && type !== "depart") {
    text += " onto " + road;
  }

  return text;
}

/* ================= MAIN ROUTE SEARCH ================= */

async function findBestRoute() {
  const startInput = document.getElementById("startLocation");

  const destinationInput = document.getElementById("destinationLocation");

  const algorithmSelect = document.getElementById("algorithm");

  const button = document.getElementById("findRouteBtn");

  const startText = startInput?.value.trim() || "";

  const destinationText = destinationInput?.value.trim() || "";

  const algorithm = algorithmSelect?.value || "astar";

  if (!startText || !destinationText) {
    showStatus("Please enter both starting location and destination.", "error");

    return;
  }

  if (startText.toLowerCase() === destinationText.toLowerCase()) {
    showStatus("Start and destination cannot be the same.", "error");

    return;
  }

  stopVoiceNavigation();

  if (button) {
    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> SEARCHING...';
  }

  showStatus("Searching starting location...", "loading");

  try {
    const start = await geocodeLocation(startText);

    showStatus("Starting location found. Searching destination...", "loading");

    const destination = await geocodeLocation(destinationText);

    showStatus("Calculating real road route...", "loading");

    const routes = await getRoadRoutes(start, destination);

    const selectedRoute = selectRoute(routes, algorithm);

    if (!selectedRoute) {
      throw new Error("Unable to select a route.");
    }

    const routeData = prepareRoute(selectedRoute);

    currentRoute = routeData;

    currentSteps = routeData.steps;

    currentStart = start;

    currentDestination = destination;

    addStartMarker(start);
    addDestinationMarker(destination);
    drawRoute(routeData.coordinates);

    updateSummary(routeData, algorithm);

    updateRouteInfo(start, destination, routeData, algorithm);

    updatePreview(start, destination, routeData, algorithm);

    showInstructions(routeData.steps);

    enableVoice();

    saveRouteHistorySafe({
    from: startText,
    to: destinationText,

    sourceLat: start.lat,
    sourceLon: start.lon,

    destinationLat: destination.lat,
    destinationLon: destination.lon,

    distanceKm: Number(routeData.distance || 0) / 1000,
    travelTime: Math.round(Number(routeData.duration || 0) / 60),

    algorithm: getAlgorithmName(algorithm),
    timestamp: new Date().toISOString(),
});

    showStatus("Route found successfully.", "success");
  } catch (error) {
    console.error("Route error:", error);

    showStatus(error.message || "Unable to calculate route.", "error");
  } finally {
    if (button) {
      button.disabled = false;

      button.innerHTML = '<i class="fa-solid fa-route"></i> FIND BEST ROUTE';
    }
  }
}

/* ================= MAP DRAWING ================= */

function addStartMarker(location) {
  if (!routeMap) return;

  if (startMarker) {
    routeMap.removeLayer(startMarker);
  }

  startMarker = L.marker([location.lat, location.lon])
    .addTo(routeMap)
    .bindPopup("<b>📍 Start</b><br>" + escapeHtml(location.displayName));
}

function addDestinationMarker(location) {
  if (!routeMap) return;

  if (destinationMarker) {
    routeMap.removeLayer(destinationMarker);
  }

  destinationMarker = L.marker([location.lat, location.lon])
    .addTo(routeMap)
    .bindPopup("<b>🏁 Destination</b><br>" + escapeHtml(location.displayName));
}

function drawRoute(coordinates) {
  if (!routeMap || !coordinates || !coordinates.length) {
    return;
  }

  if (routeLine) {
    routeMap.removeLayer(routeLine);
  }

  routeLine = L.polyline(coordinates, {
    color: "#3155ff",
    weight: 6,
    opacity: 0.9,
    lineJoin: "round",
  }).addTo(routeMap);

  routeMap.fitBounds(routeLine.getBounds(), {
    padding: [40, 40],
  });

  setTimeout(function () {
    routeMap.invalidateSize();
  }, 250);
}

/* ================= SUMMARY ================= */

function updateSummary(route, algorithm) {
  setText("routeDistance", formatDistance(route.distance));

  setText("routeTime", formatDuration(Math.round(route.duration / 60)));

  setText("selectedAlgorithm", getAlgorithmName(algorithm));

  setText("trafficInfo", "Not available");

  setText("directionDistance", formatDistance(route.distance));

  setText("directionDuration", formatDuration(Math.round(route.duration / 60)));
}

/* ================= RIGHT INFO ================= */

function updateRouteInfo(start, destination, route, algorithm) {
  const empty = document.getElementById("infoEmpty");

  const details = document.getElementById("infoDetails");

  const title = document.getElementById("infoTitle");

  const subtitle = document.getElementById("infoSubtitle");

  if (empty) {
    empty.style.display = "none";
  }

  if (title) {
    title.textContent = "Best Route Found";
  }

  if (subtitle) {
    subtitle.textContent = getAlgorithmName(algorithm) + " selected.";
  }

  if (details) {
    details.style.display = "block";

    details.innerHTML = ` <strong>From</strong><br> ${escapeHtml(start.displayName)} <br><br> <strong>To</strong><br> ${escapeHtml(destination.displayName)} <br><br> <strong>Distance:</strong> ${formatDistance(route.distance)} <br> <strong>Estimated Time:</strong> ${formatDuration(Math.round(route.duration / 60))} <br> <strong>Algorithm:</strong> ${escapeHtml(getAlgorithmName(algorithm))} `;
  }
}

/* ================= PREVIEW ================= */

function updatePreview(start, destination, route, algorithm) {
  setText("previewStart", start.displayName);

  setText("previewDestination", destination.displayName);

  const note = document.getElementById("previewNote");

  if (note) {
    note.textContent =
      getAlgorithmName(algorithm) +
      " selected • " +
      formatDistance(route.distance) +
      " • " +
      formatDuration(Math.round(route.duration / 60));
  }
}

/* ================= INSTRUCTIONS ================= */

function showInstructions(steps) {
  const container = document.getElementById("turnInstructions");

  if (!container) return;

  if (!steps || steps.length === 0) {
    container.innerHTML = ` <div class="empty"> <i class="fa-solid fa-compass"></i> <h3> No Route Instructions </h3> <p> The routing service did not return turn-by-turn instructions. </p> </div> `;

    return;
  }

  container.innerHTML = steps
    .map(function (step, index) {
      return ` <div class="step"> <div class="step-number"> ${index + 1} </div> <div class="step-main"> <div> ${escapeHtml(step.instruction)} </div> <div class="step-distance"> ${formatDistance(step.distance)} </div> </div> </div> `;
    })
    .join("");
}

/* ================= VOICE ================= */

function setupVoiceNavigation() {
  const button = document.getElementById("voiceNavigationBtn");

  if (!button) return;

  button.disabled = true;

  button.addEventListener("click", function () {
    if (voiceRunning) {
      stopVoiceNavigation();
    } else {
      startVoiceNavigation();
    }
  });
}

function enableVoice() {
  const button = document.getElementById("voiceNavigationBtn");

  const status = document.getElementById("voiceStatus");

  if (button) {
    button.disabled = false;
  }

  if (status) {
    status.textContent = "Route ready. Press Start Voice Navigation.";
  }
}

function startVoiceNavigation() {
  if (!currentSteps.length) {
    showStatus("Find a route first to use voice navigation.", "error");

    return;
  }

  if (!("speechSynthesis" in window)) {
    showStatus("Voice navigation is not supported by this browser.", "error");

    return;
  }

  window.speechSynthesis.cancel();

  voiceRunning = true;
  voiceIndex = 0;

  updateVoiceButton();

  speakNextInstruction();
}

function speakNextInstruction() {
  if (!voiceRunning) return;

  if (voiceIndex >= currentSteps.length) {
    const finalSpeech = new SpeechSynthesisUtterance(
      "You have arrived at your destination."
    );

    finalSpeech.lang = "en-IN";
    finalSpeech.rate = 0.9;
    finalSpeech.pitch = 1;
    finalSpeech.volume = 1;

    finalSpeech.onend = function () {
      voiceRunning = false;

      updateVoiceButton();

      setText("voiceStatus", "You have arrived at your destination.");
    };

    window.speechSynthesis.speak(finalSpeech);

    return;
  }

  const step = currentSteps[voiceIndex];

  let message;

  if (voiceIndex === 0) {
    message = step.instruction;
  } else if (/arrived/i.test(step.instruction)) {
    message = step.instruction;
  } else {
    message =
      "After " + formatVoiceDistance(step.distance) + ", " + step.instruction;
  }

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = "en-IN";
  speech.rate = 0.9;
  speech.pitch = 1;
  speech.volume = 1;

  setText(
    "voiceStatus",
    "Speaking step " + (voiceIndex + 1) + " of " + currentSteps.length + "..."
  );

  speech.onend = function () {
    if (!voiceRunning) return;

    voiceIndex++;

    setTimeout(speakNextInstruction, 350);
  };

  speech.onerror = function () {
    voiceRunning = false;

    updateVoiceButton();

    setText(
      "voiceStatus",
      "Voice could not start. Check browser sound permissions."
    );
  };

  window.speechSynthesis.speak(speech);
}

function stopVoiceNavigation() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  voiceRunning = false;
  voiceIndex = 0;

  updateVoiceButton();
}

function updateVoiceButton() {
  const button = document.getElementById("voiceNavigationBtn");

  if (!button) return;

  if (voiceRunning) {
    button.classList.add("stop");

    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Voice Navigation';
  } else {
    button.classList.remove("stop");

    button.innerHTML =
      '<i class="fa-solid fa-volume-high"></i> Start Voice Navigation';
  }
}

/* ================= STATUS ================= */

function showStatus(message, type) {
  const status = document.getElementById("routeStatus");

  if (!status) return;

  status.textContent = message;

  status.className = "status " + (type || "");
}

/* ================= HISTORY ================= */

function saveRouteHistorySafe(route) {
    fetch("/api/route-history", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
       body: JSON.stringify({
    source: route.from,
    destination: route.to,
    algorithm: route.algorithm,

    sourceLat: route.sourceLat,
    sourceLon: route.sourceLon,

    destinationLat: route.destinationLat,
    destinationLon: route.destinationLon,

    distance: Number(route.distanceKm || 0),
    travelTime: Number(route.travelTime || 0)
})
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("Route saved to MySQL successfully.");
        } else {
            console.error("Route save failed:", data.message);
        }
    })
    .catch(error => {
        console.error("MySQL route save error:", error);
    });
  }

/* ================= HELPERS ================= */

function formatDistance(meters) {
  meters = Number(meters) || 0;

  if (meters < 1000) {
    return Math.round(meters) + " m";
  }

  return (meters / 1000).toFixed(2) + " km";
}

function formatVoiceDistance(meters) {
  meters = Number(meters) || 0;

  if (meters < 1000) {
    return Math.max(1, Math.round(meters)) + " meters";
  }

  return (meters / 1000).toFixed(1) + " kilometers";
}

function formatDuration(minutes) {
  minutes = Number(minutes) || 0;

  if (minutes < 1) {
    return "< 1 min";
  }

  if (minutes < 60) {
    return Math.round(minutes) + " min";
  }

  const hours = Math.floor(minutes / 60);

  const remaining = Math.round(minutes % 60);

  if (remaining === 0) {
    return hours + " hr";
  }

  return hours + " hr " + remaining + " min";
}

function getAlgorithmName(algorithm) {
  switch (algorithm) {
    case "bfs":
      return "BFS";

    case "dfs":
      return "DFS";

    case "best-first":
      return "Best First Search";

    case "astar":
    default:
      return "A* Search";
  }
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
