# Smart City - Backend Setup

The project now uses a Flask backend for:

- Global location search through Nominatim
- Real road routing through OSRM
- Google OAuth login
- Facebook OAuth login
- Backend session + logout

## 1. Install Python

Install Python 3.10+ and make sure `py` works in Command Prompt.

## 2. Configure environment variables

Copy `.env.example` to `.env`.

Set:

```text
FLASK_SECRET_KEY=your-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
```

Do not commit `.env` or OAuth secrets to GitHub.

## 3. Google OAuth

Create a Web application OAuth client in Google Cloud Console.

For local testing, add this exact Authorized redirect URI:

```text
http://127.0.0.1:5000/auth/google/callback
```

If you run the app through `localhost` instead, use:

```text
http://localhost:5000/auth/google/callback
```

The URI must exactly match the one configured in Google.

## 4. Facebook OAuth

Create a Facebook/Meta app and enable Facebook Login for the Web.

Add the exact OAuth redirect URI used by the app:

```text
http://127.0.0.1:5000/auth/facebook/callback
```

For production, use your HTTPS domain instead of the local URI.

## 5. Start the project

Double-click `run.bat`.

Then open:

```text
http://127.0.0.1:5000/
```

Do NOT open `login.html` or `route-finder.html` directly from the file system or through VS Code Live Server for the backend features. The Flask server must serve the pages.

## What was changed

Only the requested areas were changed:

1. Route Finder now sends location searches to the backend, accepts locations globally, and requests real road routes from the backend.
2. Google Login now starts a real server-side OAuth flow.
3. Facebook Login now starts a real server-side OAuth flow.
4. OAuth success creates the existing frontend login state and opens the dashboard.
5. Logout clears the backend session and the existing frontend session.

The existing page design and other modules were left as-is.
