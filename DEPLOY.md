# Deploy on Render

The Render Blueprint in `render.yaml` creates the public web app, a private model API, and a private MySQL service. It also initializes the schema and imports the bundled sample CSV data on the first deploy only.

## Launch

1. Push this repository to GitHub, including the deployment files.
2. In Render, choose **New → Blueprint**, connect the repository, and select `render.yaml`.
3. Review the plan and disk charges Render displays before creating the services. MySQL needs a persistent disk; the model API and app also use paid compute plans in this Blueprint.
4. Create the Blueprint and wait for the database, model API, and app to finish deploying. Render will show the public app URL on the `credit-risk-app` service.

The first deploy runs `backend/scripts/sync.js` and imports the bundled CSVs. Later deploys do not re-import or clear your data. Back up the MySQL disk before changing its service or disk settings.

## Before sharing the app

- Replace the seeded sample entities with data approved for your deployment.
- Restrict access to the public app if it will contain real credit or customer information. The current API has no authentication or authorization layer.
- Set any database credentials only in Render's environment settings. Never commit `.env` files.

## Local container build

From the repository root, build the app image with `docker build -t credit-risk-app .`. Render builds this same Dockerfile and the separate Dockerfiles under `deploy/`.
