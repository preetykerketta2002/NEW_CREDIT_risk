# Deploy on Render

The Render Blueprint in `render.yaml` creates one FastAPI web service and a private MySQL service. FastAPI serves the API and built frontend. Its first-deploy hook creates the schema and imports the bundled sample CSV data when the tables are empty.

## Launch

1. Push this repository to GitHub, including the deployment files.
2. In Render, choose **New → Blueprint**, connect the repository, and select `render.yaml`.
3. Review the plan and disk charges Render displays before creating the services. MySQL needs a persistent disk, and the FastAPI app uses a paid compute plan in this Blueprint.
4. Create the Blueprint and wait for MySQL and the FastAPI app to finish deploying. Render will show the public URL on the `credit-risk-app` service.

The first deploy runs `python -m backend.initialize`. It creates missing tables and imports bundled rows into empty entity and threshold tables. Later deploys do not clear populated tables. Back up the MySQL disk before changing its service or disk settings.

## Before sharing the app

- Replace the seeded sample entities with data approved for your deployment.
- Users can create an account from the login page. Registration is open, and every signed-in account can access the same borrower portfolio; use an access restriction or add an invitation/approval process before exposing sensitive data publicly.
- Passwords are stored as salted PBKDF2 hashes. Sign-in uses an HTTP-only session cookie, and user search history is stored separately per account.
- Set any database credentials only in Render's environment settings. Never commit `.env` files.

## Vercel frontend with a local FastAPI backend through ngrok

Vercel hosts only the frontend in this setup. The FastAPI service and MySQL database must remain running on your computer, and the API is publicly reachable while the ngrok tunnel is active.

1. In Vercel, set the root directory to `frontend`, the framework to Vite, the build command to `npm run build`, and the output directory to `dist` (`npm ci` is the install command).
2. Add the Vercel environment variable `VITE_API_BASE_URL` with the HTTPS URL of your ngrok API, for example `https://violet-greeter-size.ngrok-free.dev`. Don't add `/api` to this value.
3. After the first Vercel deploy, copy its exact production origin (for example, `https://your-project.vercel.app`) into `FRONTEND_ORIGINS` in `backend/.env`. Include any other exact origins you use, separated by commas.
4. Add `SESSION_COOKIE_SAMESITE=none` and `SESSION_COOKIE_SECURE=true` to `backend/.env` so the browser can send the sign-in cookie from the Vercel site to the ngrok API. These settings are also shown in `backend/.env.example`.
5. From the repository root, start FastAPI with `py -3.11 -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000`, then start the tunnel in another terminal with `ngrok http 8000`.
6. Restart FastAPI after changing `.env`. If the ngrok URL changes, update `VITE_API_BASE_URL` in Vercel and redeploy the frontend.

The API only allows browser origins listed in `FRONTEND_ORIGINS`. Keep this list limited to your own frontend domains. The borrower portfolio is shared by all registered accounts, so use sample data while exposing the development backend publicly.

## Local container build

From the repository root, build the app image with `docker build -t credit-risk-app .`. Node is used only in the build stage to compile the React frontend; the running application image and API use Python/FastAPI. MySQL uses `deploy/mysql/Dockerfile`.
