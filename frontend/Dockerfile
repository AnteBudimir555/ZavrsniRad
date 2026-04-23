# WHY THIS FILE EXISTS
# --------------------
# Two-stage build:
#   1) Node image runs `npm ci` + `npm run build`, producing static files in /dist
#   2) nginx image serves those files and reverse-proxies /api/* to the backend.
#
# We don't ship Node in the final image — nginx alone is enough to serve static
# content. This keeps the frontend image under ~25 MB.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copy just the manifest first so Docker can cache the npm install layer.
# (We use `npm install` instead of `npm ci` because no package-lock.json is
# committed yet. For a reproducible production build, run `npm install` once
# locally, commit the generated package-lock.json, and switch this to `npm ci`.)
COPY package*.json ./
RUN npm ci

# Now copy sources and produce the production bundle.
COPY . .
RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine

# Replace nginx's default server block with our own (SPA + /api proxy).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built SPA from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# Default nginx entrypoint ("nginx -g 'daemon off;'") is fine.
