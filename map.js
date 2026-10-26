// ==========================================
// SMART CITY - REAL MAP
// ==========================================

let map;
let startMarker = null;
let destinationMarker = null;

let startLocation = null;
let destinationLocation = null;


// ==========================================
// INITIALIZE MAP
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    map = L.map("map").setView(
        [14.4673, 78.8242],
        13
    );

    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    // Load saved locations
    loadSavedLocations();

});


// ==========================================
// REAL CURRENT LOCATION
// ==========================================

function getCurrentLocation() {

    if (!navigator.geolocation) {

        alert(
            "Your browser does not support location."
        );

        return;
    }


    // Button message
    const button =
        document.querySelector(".location-button");

    if (button) {
        button.innerText =
            "📍 Getting Location...";
    }


    navigator.geolocation.getCurrentPosition(

        function (position) {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;


            // ----------------------------------
            // Set map to REAL GPS location
            // ----------------------------------

            map.setView(
                [lat, lng],
                16,
                {
                    animate: true
                }
            );


            // Remove old START marker
            if (startMarker) {

                map.removeLayer(
                    startMarker
                );
            }


            // Create START marker
            startMarker =
                L.marker(
                    [lat, lng]
                )
                .addTo(map)
                .bindPopup(
                    "<b>📍 Your Current Location</b>"
                )
                .openPopup();


            // Save location
            startLocation = {

                name:
                    "Your Current Location",

                lat: lat,

                lng: lng

            };


            localStorage.setItem(
                "smartCityStart",
                JSON.stringify(
                    startLocation
                )
            );


            // Update screen
            updateStartDisplay(
                "Your Current Location",
                lat,
                lng
            );


            if (button) {

                button.innerText =
                    "📍 My Location";
            }


            // Get real address
            getAddress(
                lat,
                lng,
                false
            );

        },

        function (error) {

            if (button) {

                button.innerText =
                    "📍 My Location";
            }


            if (error.code === 1) {

                alert(
                    "Location permission denied.\n\nPlease click Allow when the browser asks for your location."
                );

            } else {

                alert(
                    "Unable to get your current location."
                );

            }

        },

        {
            enableHighAccuracy: true,

            timeout: 15000,

            maximumAge: 0
        }

    );

}


// ==========================================
// SEARCH REAL DESTINATION
// ==========================================

async function searchLocation() {

    const input =
        document.getElementById(
            "locationSearch"
        );


    if (!input) {

        return;
    }


    const query =
        input.value.trim();


    if (!query) {

        alert(
            "Please enter a location."
        );

        return;
    }


    try {

        const searchUrl =
            "https://nominatim.openstreetmap.org/search?" +

            new URLSearchParams({

                q: query,

                format: "json",

                limit: 1

            });


        const response =
            await fetch(
                searchUrl
            );


        const results =
            await response.json();


        if (
            !results ||
            results.length === 0
        ) {

            alert(
                "Location not found. Try another place."
            );

            return;
        }


        const place =
            results[0];


        const lat =
            parseFloat(
                place.lat
            );


        const lng =
            parseFloat(
                place.lon
            );


        const name =
            place.display_name;


        // ----------------------------------
        // Move map to destination
        // ----------------------------------

        map.setView(
            [lat, lng],
            16,
            {
                animate: true
            }
        );


        // Remove old destination
        if (destinationMarker) {

            map.removeLayer(
                destinationMarker
            );
        }


        // Create DESTINATION marker
        destinationMarker =
            L.marker(
                [lat, lng]
            )
            .addTo(map)
            .bindPopup(
                "<b>🏁 Destination</b><br>" +
                name
            )
            .openPopup();


        // Save destination
        destinationLocation = {

            name: name,

            lat: lat,

            lng: lng

        };


        localStorage.setItem(
            "smartCityDestination",
            JSON.stringify(
                destinationLocation
            )
        );


        // Update destination display
        updateDestinationDisplay(
            name,
            lat,
            lng
        );


    }

    catch (error) {

        console.error(error);

        alert(
            "Unable to search location."
        );

    }

}


// ==========================================
// MAP CLICK = DESTINATION
// ==========================================

function enableMapDestinationSelection() {

    map.on(
        "click",
        async function (event) {

            // Start must be selected first
            if (!startLocation) {

                alert(
                    "First click My Location to set your starting point."
                );

                return;
            }


            const lat =
                event.latlng.lat;

            const lng =
                event.latlng.lng;


            // Remove old destination
            if (destinationMarker) {

                map.removeLayer(
                    destinationMarker
                );
            }


            destinationMarker =
                L.marker(
                    [lat, lng]
                )
                .addTo(map)
                .bindPopup(
                    "<b>🏁 Destination</b>"
                )
                .openPopup();


            destinationLocation = {

                name:
                    "Selected Destination",

                lat: lat,

                lng: lng

            };


            localStorage.setItem(
                "smartCityDestination",
                JSON.stringify(
                    destinationLocation
                )
            );


            updateDestinationDisplay(
                "Selected Destination",
                lat,
                lng
            );


            // Try to get actual address
            getAddress(
                lat,
                lng,
                true
            );

        }
    );

}


// ==========================================
// GET REAL ADDRESS
// ==========================================

async function getAddress(
    lat,
    lng,
    isDestination
) {

    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse?" +

            new URLSearchParams({

                lat: lat,

                lon: lng,

                format: "json"

            });


        const response =
            await fetch(url);


        const data =
            await response.json();


        if (!data.display_name) {

            return;
        }


        const address =
            data.display_name;


        if (isDestination) {

            destinationLocation.name =
                address;


            localStorage.setItem(
                "smartCityDestination",
                JSON.stringify(
                    destinationLocation
                )
            );


            updateDestinationDisplay(
                address,
                lat,
                lng
            );

        }

        else {

            startLocation.name =
                address;


            localStorage.setItem(
                "smartCityStart",
                JSON.stringify(
                    startLocation
                )
            );


            updateStartDisplay(
                address,
                lat,
                lng
            );

        }

    }

    catch (error) {

        console.log(
            "Address lookup unavailable."
        );

    }

}


// ==========================================
// START DISPLAY
// ==========================================

function updateStartDisplay(
    name,
    lat,
    lng
) {

    const element =
        document.getElementById(
            "startLocation"
        );


    if (element) {

        element.innerHTML =

            `<strong>${name}</strong>
             <br>
             ${lat.toFixed(5)},
             ${lng.toFixed(5)}`;

    }

}


// ==========================================
// DESTINATION DISPLAY
// ==========================================

function updateDestinationDisplay(
    name,
    lat,
    lng
) {

    const element =
        document.getElementById(
            "destinationLocation"
        );


    if (element) {

        element.innerHTML =

            `<strong>${name}</strong>
             <br>
             ${lat.toFixed(5)},
             ${lng.toFixed(5)}`;

    }

}


// ==========================================
// LOAD SAVED LOCATIONS
// ==========================================

function loadSavedLocations() {

    const savedStart =
        localStorage.getItem(
            "smartCityStart"
        );


    const savedDestination =
        localStorage.getItem(
            "smartCityDestination"
        );


    // START
    if (savedStart) {

        startLocation =
            JSON.parse(
                savedStart
            );


        startMarker =
            L.marker([
                startLocation.lat,
                startLocation.lng
            ])
            .addTo(map)
            .bindPopup(
                "📍 Start Location"
            );


        updateStartDisplay(
            startLocation.name,
            startLocation.lat,
            startLocation.lng
        );

    }


    // DESTINATION
    if (savedDestination) {

        destinationLocation =
            JSON.parse(
                savedDestination
            );


        destinationMarker =
            L.marker([
                destinationLocation.lat,
                destinationLocation.lng
            ])
            .addTo(map)
            .bindPopup(
                "🏁 Destination"
            );


        updateDestinationDisplay(
            destinationLocation.name,
            destinationLocation.lat,
            destinationLocation.lng
        );

    }


    // Enable map destination selection
    enableMapDestinationSelection();

}