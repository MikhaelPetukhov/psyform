# syntax=docker/dockerfile:1.4
# Stage 1: Build the React application
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Speed up and stabilize install with npm ci and cache
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using a lightweight server
FROM nginx:stable-alpine

# Copy the built assets from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
