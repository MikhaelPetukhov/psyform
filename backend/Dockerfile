# syntax=docker/dockerfile:1.4
# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages specified in package.json
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Bundle app source
COPY . ./

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV NODE_ENV=development

# Run the app when the container launches
CMD [ "node", "server.js" ]
