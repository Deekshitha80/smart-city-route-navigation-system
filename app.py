import os
from urllib.parse import urlencode

import smtplib
import requests
import mysql.connector
import secrets

from werkzeug.security import check_password_hash, generate_password_hash
from email.message import EmailMessage
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for
)
from datetime import datetime, timedelta


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# FLASK APPLICATION
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    static_folder=None
)

app.secret_key = os.getenv("FLASK_SECRET_KEY")

if not app.secret_key:
    raise RuntimeError("FLASK_SECRET_KEY is missing from .env")

MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")

from itsdangerous import URLSafeTimedSerializer

reset_serializer = URLSafeTimedSerializer(app.secret_key)

from flask_mail import Mail

app.config["MAIL_SERVER"] = MAIL_SERVER
app.config["MAIL_PORT"] = MAIL_PORT
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = MAIL_USERNAME
app.config["MAIL_PASSWORD"] = MAIL_PASSWORD
app.config["MAIL_DEFAULT_SENDER"] = MAIL_USERNAME

mail = Mail(app)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


# =========================================================
# MYSQL DATABASE CONFIGURATION
# =========================================================

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "smart_city")
}


def get_db_connection():
    """
    Create and return a MySQL database connection.
    """

    return mysql.connector.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_CONFIG["database"]
    )


# =========================================================
# OAUTH SETUP
# =========================================================

oauth = OAuth(app)


# -------------------------
# Google OAuth
# -------------------------

google = oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url=(
        "https://accounts.google.com/"
        ".well-known/openid-configuration"
    ),
    client_kwargs={
        "scope": "openid email profile"
    }
)


# -------------------------
# Facebook OAuth
# -------------------------

facebook = oauth.register(
    name="facebook",
    client_id=os.getenv("FACEBOOK_CLIENT_ID"),
    client_secret=os.getenv("FACEBOOK_CLIENT_SECRET"),
    access_token_url=(
        "https://graph.facebook.com/v26.0/"
        "oauth/access_token"
    ),
    authorize_url=(
        "https://www.facebook.com/v26.0/"
        "dialog/oauth"
    ),
    api_base_url=(
        "https://graph.facebook.com/v26.0/"
    ),
    client_kwargs={
        "scope": "email,public_profile"
    }
)


# =========================================================
# FRONTEND FILE SERVING
# =========================================================

@app.route("/")
def index():
    return send_from_directory(
        BASE_DIR,
        "index.html"
    )


@app.route("/<path:path>")
def static_files(path):

    full_path = os.path.join(
        BASE_DIR,
        path
    )

    if os.path.isfile(full_path):
        return send_from_directory(
            BASE_DIR,
            path
        )

    return (
        "Not found",
        404
    )


# =========================================================
# GEOCODING API
# Nominatim + Photon fallback
# =========================================================

@app.get("/api/geocode")
def geocode():

    place = request.args.get(
        "q",
        ""
    ).strip()

    if not place:
        return jsonify({
            "success": False,
            "message": "Please enter a location."
        }), 400


    # -----------------------------------------------------
    # PRIMARY SERVICE — NOMINATIM
    # -----------------------------------------------------

    try:

        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": place,
                "format": "json",
                "limit": 1,
                "addressdetails": 1
            },
            headers={
                "User-Agent":
                    "SmartCityRouteNavigation/1.0 "
                    "(College Project)",
                "Accept":
                    "application/json"
            },
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        if data:

            item = data[0]

            return jsonify({
                "success": True,
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "displayName":
                    item.get(
                        "display_name",
                        place
                    )
            })

    except Exception as error:

        print(
            "Nominatim geocoding failed:",
            error
        )


    # -----------------------------------------------------
    # FALLBACK SERVICE — PHOTON
    # -----------------------------------------------------

    try:

        response = requests.get(
            "https://photon.komoot.io/api/",
            params={
                "q": place,
                "limit": 1
            },
            headers={
                "User-Agent":
                    "SmartCityRouteNavigation/1.0"
            },
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        features = data.get(
            "features",
            []
        )

        if features:

            feature = features[0]

            coordinates = feature[
                "geometry"
            ][
                "coordinates"
            ]

            properties = feature.get(
                "properties",
                {}
            )

            display_parts = []

            for key in [
                "name",
                "city",
                "state",
                "country"
            ]:

                value = properties.get(key)

                if (
                    value
                    and value not in display_parts
                ):
                    display_parts.append(value)

            display_name = ", ".join(
                display_parts
            )

            if not display_name:
                display_name = place

            return jsonify({
                "success": True,
                "lat":
                    float(coordinates[1]),
                "lon":
                    float(coordinates[0]),
                "displayName":
                    display_name
            })

    except Exception as error:

        print(
            "Photon geocoding failed:",
            error
        )


    # -----------------------------------------------------
    # BOTH SERVICES FAILED
    # -----------------------------------------------------

    return jsonify({
        "success": False,
        "message":
            "Location search is temporarily "
            "unavailable. Please check your "
            "internet connection and try again."
    }), 502


# =========================================================
# REAL-TIME TRAFFIC API — TOMTOM
# =========================================================

@app.route("/api/traffic")
def traffic_api():

    try:

        lat = request.args.get(
            "lat",
            type=float
        )

        lon = request.args.get(
            "lon",
            type=float
        )


        if lat is None or lon is None:

            return jsonify({
                "success": False,
                "message":
                    "Latitude and longitude "
                    "are required."
            }), 400


        if not (
            -90 <= lat <= 90
            and
            -180 <= lon <= 180
        ):

            return jsonify({
                "success": False,
                "message":
                    "Invalid coordinates."
            }), 400


        api_key = os.getenv(
            "TOMTOM_API_KEY"
        )


        if not api_key:

            return jsonify({
                "success": False,
                "message":
                    "TomTom Traffic API key "
                    "is not configured."
            }), 500


        # -------------------------------------------------
        # TOMTOM TRAFFIC FLOW
        # -------------------------------------------------

        url = (
            "https://api.tomtom.com/"
            "traffic/services/4/"
            "flowSegmentData/absolute/"
            "10/json"
        )


        params = {
            "key": api_key,
            "point":
                f"{lat},{lon}"
        }


        response = requests.get(
            url,
            params=params,
            timeout=15
        )


        if response.status_code != 200:

            return jsonify({
                "success": False,
                "message":
                    "Traffic provider returned "
                    f"HTTP {response.status_code}."
            }), 502


        provider_data = response.json()


        flow = provider_data.get(
            "flowSegmentData",
            {}
        )


        current_speed = flow.get(
            "currentSpeed"
        )


        free_flow_speed = flow.get(
            "freeFlow"
        )


        # Do not treat zero as a real
        # free-flow speed.
        if (
            isinstance(
                free_flow_speed,
                (int, float)
            )
            and
            free_flow_speed <= 0
        ):

            free_flow_speed = None


        confidence = flow.get(
            "confidence"
        )


        coordinates = (
            flow
            .get(
                "coordinates",
                {}
            )
            .get(
                "coordinate",
                []
            )
        )


        # -------------------------------------------------
        # CALCULATE CONGESTION
        # -------------------------------------------------

        congestion = None


        if (
            isinstance(
                current_speed,
                (int, float)
            )
            and
            isinstance(
                free_flow_speed,
                (int, float)
            )
            and
            free_flow_speed > 0
        ):

            congestion = (
                1 -
                (
                    current_speed /
                    free_flow_speed
                )
            ) * 100


            congestion = max(
                0,
                min(
                    100,
                    congestion
                )
            )


        # -------------------------------------------------
        # TRAFFIC CLASSIFICATION
        # -------------------------------------------------

        if congestion is None:

            status = "Unknown"

        elif congestion <= 25:

            status = "Low"

        elif congestion <= 60:

            status = "Moderate"

        else:

            status = "Heavy"


        # -------------------------------------------------
        # CONVERT TOMTOM COORDINATES
        # TO LEAFLET [LAT, LON]
        # -------------------------------------------------

        segment_coordinates = []


        for point in coordinates:

            point_lat = point.get(
                "latitude"
            )

            point_lon = point.get(
                "longitude"
            )


            if (
                isinstance(
                    point_lat,
                    (int, float)
                )
                and
                isinstance(
                    point_lon,
                    (int, float)
                )
            ):

                segment_coordinates.append([
                    point_lat,
                    point_lon
                ])


        # -------------------------------------------------
        # SEND DATA TO traffic.js
        # -------------------------------------------------

        return jsonify({

            "success": True,

            "status": status,

            "current_speed":
                current_speed,

            "free_flow_speed":
                free_flow_speed,

            "congestion":
                congestion,

            "confidence":
                confidence,

            "updated_at":
                __import__(
                    "datetime"
                ).datetime.now().isoformat(),

            "segments": [

                {
                    "coordinates":
                        segment_coordinates,

                    "current_speed":
                        current_speed,

                    "free_flow_speed":
                        free_flow_speed,

                    "congestion":
                        congestion,

                    "status":
                        status
                }

            ]

        })


    except requests.exceptions.Timeout:

        return jsonify({
            "success": False,
            "message":
                "Traffic provider request "
                "timed out."
        }), 504


    except requests.exceptions.RequestException:

        return jsonify({
            "success": False,
            "message":
                "Unable to connect to "
                "traffic provider."
        }), 502


    except Exception as error:

        print(
            "Traffic API error:",
            error
        )

        return jsonify({
            "success": False,
            "message":
                "Unexpected traffic "
                "service error."
        }), 500


# =========================================================
# ROAD ROUTING API — OSRM
# =========================================================

@app.get("/api/route")
def route():

    try:

        start_lat = float(
            request.args["start_lat"]
        )

        start_lon = float(
            request.args["start_lon"]
        )

        dest_lat = float(
            request.args["dest_lat"]
        )

        dest_lon = float(
            request.args["dest_lon"]
        )

    except (
        KeyError,
        ValueError
    ):

        return jsonify({
            "success": False,
            "error":
                "Invalid route coordinates."
        }), 400


    url = (
        "https://router.project-osrm.org/"
        "route/v1/driving/"
        f"{start_lon},{start_lat};"
        f"{dest_lon},{dest_lat}"
    )


    try:

        response = requests.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "alternatives": "true"
            },
            timeout=30
        )

        response.raise_for_status()

        data = response.json()

    except requests.RequestException:

        return jsonify({
            "success": False,
            "error":
                "Road routing service "
                "is unavailable."
        }), 502


    if (
        data.get("code") != "Ok"
        or
        not data.get("routes")
    ):

        return jsonify({
            "success": False,
            "error":
                "No road route found "
                "between these locations."
        }), 404


    return jsonify({
        "success": True,
        "routes":
            data["routes"]
    })


# =========================================================
# PART 1 ENDS HERE
# =========================================================

# =========================================================
# GOOGLE OAUTH
# =========================================================

@app.get("/auth/google")
def auth_google():

    if (
        not os.getenv("GOOGLE_CLIENT_ID")
        or
        not os.getenv("GOOGLE_CLIENT_SECRET")
    ):
        return oauth_setup_error("Google")


    redirect_uri = (
        request.url_root.rstrip("/")
        + "/auth/google/callback"
    )


    return google.authorize_redirect(
        redirect_uri
    )


@app.get("/auth/google/callback")
def auth_google_callback():

    try:

        token = google.authorize_access_token()


        userinfo = token.get(
            "userinfo"
        )


        if not userinfo:

            userinfo = google.get(
                "https://openidconnect.googleapis.com/"
                "v1/userinfo"
            ).json()


        session["user"] = {

            "id":
                userinfo.get("sub"),

            "name":
                userinfo.get("name")
                or
                userinfo.get(
                    "email",
                    "Google User"
                ),

            "email":
                userinfo.get(
                    "email",
                    ""
                ),

            "provider":
                "Google"
        }


        session["logged_in"] = True


        return redirect(
            "/oauth-success.html"
        )


    except Exception as exc:

        app.logger.exception(
            "Google OAuth failed"
        )

        return oauth_error(
            "Google",
            str(exc)
        )


# =========================================================
# FACEBOOK OAUTH
# =========================================================

@app.get("/auth/facebook")
def auth_facebook():

    if (
        not os.getenv("FACEBOOK_CLIENT_ID")
        or
        not os.getenv("FACEBOOK_CLIENT_SECRET")
    ):
        return oauth_setup_error("Facebook")


    redirect_uri = (
        request.url_root.rstrip("/")
        + "/auth/facebook/callback"
    )


    return facebook.authorize_redirect(
        redirect_uri
    )


@app.get("/auth/facebook/callback")
def auth_facebook_callback():

    try:

        token = facebook.authorize_access_token()


        response = facebook.get(
            "me",
            params={
                "fields":
                    "id,name,email"
            }
        )


        profile = response.json()


        if profile.get("error"):

            raise RuntimeError(
                profile["error"].get(
                    "message",
                    "Facebook profile "
                    "request failed"
                )
            )


        session["user"] = {

            "id":
                profile.get("id"),

            "name":
                profile.get("name")
                or
                profile.get(
                    "email",
                    "Facebook User"
                ),

            "email":
                profile.get(
                    "email",
                    ""
                ),

            "provider":
                "Facebook"
        }


        session["logged_in"] = True


        return redirect(
            "/oauth-success.html"
        )


    except Exception as exc:

        app.logger.exception(
            "Facebook OAuth failed"
        )

        return oauth_error(
            "Facebook",
            str(exc)
        )


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/api/me")
def me():

    if (
        not session.get("logged_in")
        or
        not session.get("user")
    ):

        return jsonify({
            "authenticated": False
        }), 401


    return jsonify({

        "authenticated": True,

        "user":
            session["user"]

    })


# =========================================================
# LOGOUT
# =========================================================

@app.post("/auth/logout")
def auth_logout():

    session.clear()

    return jsonify({
        "ok": True
    })


# =========================================================
# OAUTH ERROR HELPERS
# =========================================================

def oauth_setup_error(provider):

    env_prefix = provider.upper()


    message = (
        f"{provider} OAuth is not configured yet. "
        f"Add {env_prefix}_CLIENT_ID and "
        f"{env_prefix}_CLIENT_SECRET to the "
        f".env file, then restart the server."
    )


    return oauth_error(
        provider,
        message
    )


def oauth_error(provider, message):

    params = urlencode({

        "provider":
            provider,

        "message":
            message

    })


    return redirect(
        f"/oauth-error.html?{params}"
    )

# =========================================================
# ROUTE HISTORY - SAVE NEW ROUTE
# =========================================================

@app.route("/api/route-history", methods=["POST"])
def save_route_history():

    connection = None
    cursor = None

    try:

        data = request.get_json() or {}

        source = str(
            data.get("source", "")
        ).strip()

        destination = str(
            data.get("destination", "")
        ).strip()

        algorithm = str(
            data.get("algorithm", "")
        ).strip()

        source_lat = data.get("sourceLat")
        source_lon = data.get("sourceLon")

        destination_lat = data.get("destinationLat")
        destination_lon = data.get("destinationLon")

        distance = data.get("distance")
        travel_time = data.get("travelTime")


        # -------------------------------------------------
        # VALIDATION
        # -------------------------------------------------

        if not source or not destination or not algorithm:

            return jsonify({
                "success": False,
                "message":
                    "Source, destination and algorithm are required."
            }), 400


        try:

            source_lat = float(source_lat)
            source_lon = float(source_lon)

            destination_lat = float(destination_lat)
            destination_lon = float(destination_lon)

            distance = float(distance or 0)
            travel_time = int(travel_time or 0)

        except (TypeError, ValueError):

            return jsonify({
                "success": False,
                "message":
                    "Invalid route coordinates or route values."
            }), 400


        # -------------------------------------------------
        # DATABASE CONNECTION
        # -------------------------------------------------

        connection = get_db_connection()

        cursor = connection.cursor()


        # -------------------------------------------------
        # FIND / CREATE SOURCE LOCATION
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT location_id
            FROM locations
            WHERE location_name = %s
            LIMIT 1
            """,
            (source,)
        )

        source_row = cursor.fetchone()


        if source_row:

            source_id = source_row[0]

        else:

            cursor.execute(
                """
                INSERT INTO locations
                (
                    location_name,
                    latitude,
                    longitude
                )
                VALUES (%s, %s, %s)
                """,
                (
                    source,
                    source_lat,
                    source_lon
                )
            )

            source_id = cursor.lastrowid


        # -------------------------------------------------
        # FIND / CREATE DESTINATION LOCATION
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT location_id
            FROM locations
            WHERE location_name = %s
            LIMIT 1
            """,
            (destination,)
        )

        destination_row = cursor.fetchone()


        if destination_row:

            destination_id = destination_row[0]

        else:

            cursor.execute(
                """
                INSERT INTO locations
                (
                    location_name,
                    latitude,
                    longitude
                )
                VALUES (%s, %s, %s)
                """,
                (
                    destination,
                    destination_lat,
                    destination_lon
                )
            )

            destination_id = cursor.lastrowid


        # -------------------------------------------------
        # SAVE ROUTE
        # -------------------------------------------------

        cursor.execute(
            """
            INSERT INTO routes
            (
                source_id,
                destination_id,
                distance,
                travel_time,
                route_type
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                source_id,
                destination_id,
                distance,
                travel_time,
                algorithm
            )
        )


        route_id = cursor.lastrowid

        connection.commit()

        # -------------------------------------------------
        # SUCCESS
        # -------------------------------------------------

        return jsonify({

            "success": True,

            "message":
                "Route saved successfully.",

            "route_id":
                route_id

        })


    except Exception as error:

        if connection:

            connection.rollback()


        print(
            "Save route history error:",
            error
        )


        return jsonify({

            "success": False,

            "message":
                "Unable to save route history."

        }), 500


    finally:

        if cursor:

            cursor.close()

        if connection:

            connection.close()

# =========================================================
# ROUTE HISTORY — GET
# =========================================================
      
@app.route("/api/route-history", methods=["GET"])
def get_route_history():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                r.route_id,
                s.location_name AS source,
                d.location_name AS destination,
                r.distance,
                r.travel_time,
                r.route_type AS algorithm,
                r.searched_at
            FROM routes r
            LEFT JOIN locations s
                ON r.source_id = s.location_id
            LEFT JOIN locations d
                ON r.destination_id = d.location_id
            ORDER BY r.searched_at DESC
        """)

        rows = cursor.fetchall()

        routes = []

        for row in rows:
            routes.append({
                "route_id": row[0],
                "source": row[1],
                "destination": row[2],
                "distance": float(row[3]) if row[3] is not None else 0,
                "travel_time": int(row[4]) if row[4] is not None else 0,
                "algorithm": row[5],
                "searched_at": row[6].isoformat() if row[6] else None
            })

        return jsonify({
            "success": True,
            "routes": routes
        })

    except Exception as error:

        print("Get route history error:", error)

        return jsonify({
            "success": False,
            "message": "Unable to load route history."
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()



@app.route("/api/dashboard-data", methods=["GET"])
def dashboard_data():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Total routes
        cursor.execute("""
            SELECT COUNT(*)
            FROM routes
        """)
        total_routes = cursor.fetchone()[0]

        # Total distance
        cursor.execute("""
            SELECT COALESCE(SUM(distance), 0)
            FROM routes
        """)
        total_distance = cursor.fetchone()[0]

        # Algorithm usage
        cursor.execute("""
            SELECT route_type, COUNT(*)
            FROM routes
            GROUP BY route_type
        """)
        algorithm_rows = cursor.fetchall()

        algorithm_usage = {}

        for row in algorithm_rows:
            algorithm_usage[row[0]] = row[1]

        # Recent routes
        cursor.execute("""
            SELECT
                r.route_id,
                s.location_name AS source,
                d.location_name AS destination,
                r.distance,
                r.travel_time,
                r.route_type AS algorithm,
                r.searched_at
            FROM routes r
            LEFT JOIN locations s
                ON r.source_id = s.location_id
            LEFT JOIN locations d
                ON r.destination_id = d.location_id
            ORDER BY r.searched_at DESC
            LIMIT 5
        """)

        rows = cursor.fetchall()

        recent_routes = []

        for row in rows:
            recent_routes.append({
                "route_id": row[0],
                "source": row[1],
                "destination": row[2],
                "distance": float(row[3]) if row[3] is not None else 0,
                "travel_time": int(row[4]) if row[4] is not None else 0,
                "algorithm": row[5],
                "searched_at": row[6].isoformat() if row[6] else None
            })

        return jsonify({
            "success": True,
            "total_routes": total_routes,
            "total_distance": float(total_distance or 0),
            "algorithm_usage": algorithm_usage,
            "recent_routes": recent_routes
        })

    except Exception as error:

        print("Dashboard data error:", error)

        return jsonify({
            "success": False,
            "message": "Unable to load dashboard data."
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()

# =========================================================
# ROUTE HISTORY - STATISTICS
# =========================================================

@app.route("/api/route-history/stats", methods=["GET"])
def route_history_stats():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )


        # ---------------------------------------------
        # TOTAL ROUTES
        # ---------------------------------------------

        cursor.execute("""
            SELECT COUNT(*) AS total_routes
            FROM routes
        """)

        total_result = cursor.fetchone()


        # ---------------------------------------------
        # TOTAL DISTANCE
        # ---------------------------------------------

        cursor.execute("""
            SELECT
                COALESCE(
                    SUM(distance),
                    0
                ) AS total_distance
            FROM routes
        """)

        distance_result = cursor.fetchone()


        # ---------------------------------------------
        # MOST USED ALGORITHM
        # ---------------------------------------------

        cursor.execute("""
            SELECT
                route_type AS algorithm,
                COUNT(*) AS usage_count

            FROM routes

            GROUP BY route_type

            ORDER BY usage_count DESC

            LIMIT 1
        """)

        algorithm_result = cursor.fetchone()


        # ---------------------------------------------
        # LATEST SEARCH
        # ---------------------------------------------

        cursor.execute("""
            SELECT

                r.route_id AS id,

                s.location_name AS source,

                d.location_name AS destination,

                r.route_type AS algorithm,

                r.distance AS distance_km,

                r.searched_at

            FROM routes r

            LEFT JOIN locations s
                ON r.source_id = s.location_id

            LEFT JOIN locations d
                ON r.destination_id = d.location_id

            ORDER BY r.searched_at DESC

            LIMIT 1
        """)

        latest_result = cursor.fetchone()


        # ---------------------------------------------
        # CONVERT DECIMAL
        # ---------------------------------------------

        total_distance = float(
            distance_result["total_distance"] or 0
        )


        # ---------------------------------------------
        # RESPONSE
        # ---------------------------------------------

        return jsonify({

            "success": True,

            "total_routes":
                total_result["total_routes"],

            "total_distance":
                total_distance,

            "most_used_algorithm":
                algorithm_result["algorithm"]
                if algorithm_result
                else None,

            "latest_search":
                latest_result
                if latest_result
                else None

        })


    except Exception as error:

        print(
            "Route history stats error:",
            error
        )

        return jsonify({

            "success": False,

            "message":
                "Unable to load route statistics."

        }), 500


    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()



# =========================================================
# DELETE ONE ROUTE FROM HISTORY
# =========================================================

@app.route(
    "/api/route-history/<int:route_id>",
    methods=["DELETE"]
)
def delete_route_history(route_id):

    connection = None
    cursor = None


    try:

        connection = get_db_connection()


        cursor = connection.cursor()


        cursor.execute(
            """
            DELETE FROM route_history
            WHERE id = %s
            """,
            (route_id,)
        )


        connection.commit()


        if cursor.rowcount == 0:

            return jsonify({

                "success": False,

                "message":
                    "Route history record "
                    "was not found."

            }), 404


        return jsonify({

            "success": True,

            "message":
                "Route deleted successfully."

        })


    except Exception as error:

        print(
            "Delete route history error:",
            error
        )


        if connection:

            connection.rollback()


        return jsonify({

            "success": False,

            "message":
                "Unable to delete route."

        }), 500


    finally:

        if cursor:

            cursor.close()


        if connection:

            connection.close()


# =========================================================
# CLEAR ALL ROUTE HISTORY
# =========================================================

@app.route(
    "/api/route-history",
    methods=["DELETE"]
)
def clear_route_history():

    connection = None
    cursor = None


    try:

        connection = get_db_connection()


        cursor = connection.cursor()


        cursor.execute(
            "DELETE FROM route_history"
        )


        connection.commit()


        return jsonify({

            "success": True,

            "message":
                "All route history cleared successfully."

        })


    except Exception as error:

        print(
            "Clear route history error:",
            error
        )


        if connection:

            connection.rollback()


        return jsonify({

            "success": False,

            "message":
                "Unable to clear route history."

        }), 500


    finally:

        if cursor:

            cursor.close()


        if connection:

            connection.close()


# =========================================================
# PART 2 ENDS HERE
# =========================================================

# =========================================================
# APPLICATION ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def page_not_found(error):

    return jsonify({
        "success": False,
        "message": "Page or API endpoint not found."
    }), 404


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({
        "success": False,
        "message": "Internal server error."
    }), 500

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}

    name = data.get("fullName", "").strip()
    email = data.get("email", "").strip().lower()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    confirm_password = data.get("confirmPassword", "")

    if not name or not email or not username or not password:
        return jsonify({
            "success": False,
            "message": "Please fill all required fields."
        }), 400

    if confirm_password and password != confirm_password:
        return jsonify({
            "success": False,
            "message": "Passwords do not match."
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 6 characters."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT user_id FROM users WHERE LOWER(email) = %s LIMIT 1",
            (email,)
        )

        if cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Email already registered. Please log in."
            }), 409

        cursor.execute(
            "INSERT INTO users (name, email, username, password) VALUES (%s, %s, %s, %s)",
            (name, email, username, generate_password_hash(password))
        )
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Registration successful. Please log in."
        }), 201

    except Exception:
        app.logger.exception("Registration failed")
        if connection:
            connection.rollback()
        return jsonify({
            "success": False,
            "message": "Registration failed: " + str(__import__('sys').exc_info()[1])
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}

    login_value = (
        data.get("email")
        or data.get("username")
        or ""
    ).strip()

    password = data.get("password", "")

    if not login_value or not password:
        return jsonify({
            "success": False,
            "message": "Enter username/email and password."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT user_id, name, email, username, password
            FROM users
            WHERE LOWER(username) = LOWER(%s)
            LIMIT 1
            """,
            (login_value,)
        )

        account = cursor.fetchone()

        if not account or not account["password"]:
            return jsonify({
                "success": False,
                "message": "Invalid email/username or password."
            }), 401

        stored_password = account["password"]

        password_valid = (
            check_password_hash(stored_password, password)
            if stored_password.startswith(("scrypt:", "pbkdf2:", "argon2:"))
            else stored_password == password
        )

        if not password_valid:
            return jsonify({
                "success": False,
                "message": "Invalid email/username or password."
            }), 401

        session.clear()
        session["logged_in"] = True
        session["user"] = {
            "user_id": account["user_id"],
            "name": account["name"],
            "email": account["email"]
        }

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "user": {
                "user_id": account["user_id"],
                "username": account["name"],
                "fullName": account["name"],
                "email": account["email"]
            }
        })

    except Exception:
        app.logger.exception("Login failed")
        return jsonify({
            "success": False,
            "message": "Unable to log in. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200

@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({
            "success": False,
            "message": "Please enter your registered email address."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT user_id, name, email FROM users WHERE LOWER(email) = %s LIMIT 1",
            (email,)
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "success": False,
                "message": "No account found for that email address."
            }), 404

        token = reset_serializer.dumps(email, salt="password-reset")
        reset_url = url_for(
            "reset_password_page",
            token=token,
            _external=True
        )

        msg = Message(
            subject="Smart City - Password Reset",
            recipients=[email],
            body=(
                f"Hello {user.get('name', 'User')},\n\n"
                f"Click this link to reset your password:\n{reset_url}\n\n"
                "This link expires in 15 minutes. "
                "If you did not request this, ignore this email."
            )
        )
        mail.send(msg)

        return jsonify({
            "success": True,
            "message": "Password reset link sent to your email."
        })

    except Exception:
        app.logger.exception("Forgot-password request failed")
        return jsonify({
            "success": False,
            "message": "Unable to send the reset email. Check server configuration."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route("/api/change-password", methods=["POST"])
def change_password():
    if not session.get("logged_in") or not session.get("user"):
        return jsonify({
            "success": False,
            "message": "Please log in first."
        }), 401

    data = request.get_json(silent=True) or {}

    current_password = data.get("currentPassword", "")
    new_password = data.get("newPassword", "")
    confirm_password = data.get("confirmPassword", "")

    if not current_password or not new_password or not confirm_password:
        return jsonify({
            "success": False,
            "message": "Please fill in all password fields."
        }), 400

    if new_password != confirm_password:
        return jsonify({
            "success": False,
            "message": "New passwords do not match."
        }), 400

    if len(new_password) < 8:
        return jsonify({
            "success": False,
            "message": "New password must contain at least 8 characters."
        }), 400

    user = session["user"]
    email = user.get("email")

    if not email:
        return jsonify({
            "success": False,
            "message": "Your account email was not found."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT user_id, password FROM users WHERE email = %s",
            (email,)
        )
        account = cursor.fetchone()

        if not account or not account.get("password"):
            return jsonify({
                "success": False,
                "message": "This account has no local password. Use your login provider."
            }), 400

        stored_password = account["password"]

        # Support hashed passwords and existing plain-text passwords.
        if stored_password.startswith(("pbkdf2:", "scrypt:")):
            password_valid = check_password_hash(
                stored_password, current_password
            )
        else:
            password_valid = stored_password == current_password

        if not password_valid:
            return jsonify({
                "success": False,
                "message": "Current password is incorrect."
            }), 400

        cursor.execute(
            "UPDATE users SET password = %s WHERE user_id = %s",
            (generate_password_hash(new_password), account["user_id"])
        )
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Password changed successfully."
        })

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Password update failed")
        return jsonify({
            "success": False,
            "message": "Unable to update password. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}

    token = data.get("token", "").strip()
    new_password = data.get("newPassword", "")
    confirm_password = data.get("confirmPassword", "")

    if not token or not new_password or not confirm_password:
        return jsonify({
            "success": False,
            "message": "Please fill in all fields."
        }), 400

    if new_password != confirm_password:
        return jsonify({
            "success": False,
            "message": "Passwords do not match."
        }), 400

    if len(new_password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    try:
        email = reset_serializer.loads(
            token,
            salt="password-reset",
            max_age=900
        )
    except Exception:
        return jsonify({
            "success": False,
            "message": "Reset link is invalid or expired."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "UPDATE users SET password = %s WHERE LOWER(email) = %s",
            (generate_password_hash(new_password), email.lower())
        )

        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({
                "success": False,
                "message": "Account not found."
            }), 404

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Password reset successful. Please log in."
        })

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Password reset failed")
        return jsonify({
            "success": False,
            "message": "Unable to reset password. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route("/reset-password/<token>", methods=["GET"])
def reset_password_page(token):
    try:
        email = reset_serializer.loads(
            token,
            salt="password-reset",
            max_age=900
        )
    except Exception:
        return """
        <h2>Password reset link is invalid or expired.</h2>
        <a href="/login.html">Return to Login</a>
        """, 400

    return render_template(
        "reset_password.html",
        token=token
    )

# =========================================================
# APPLICATION START
# IMPORTANT: THIS MUST BE THE LAST CODE IN app.py
# =========================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=int(
            os.getenv(
                "PORT",
                "5000"
            )
        ),
        debug=True
    )


