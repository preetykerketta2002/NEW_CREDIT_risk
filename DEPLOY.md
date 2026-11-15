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

## Local container build

From the repository root, build the app image with `docker build -t credit-risk-app .`. Node is used only in the build stage to compile the React frontend; the running application image and API use Python/FastAPI. MySQL uses `deploy/mysql/Dockerfile`.
