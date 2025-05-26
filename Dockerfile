# Use the official Node.js image.
FROM node:20

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install production dependencies.
RUN npm install --include=optional sharp

# Copy application code.
COPY . .

# Build the TypeScript code.
RUN npm run build

RUN touch .env.example

# Run the web service on container startup.
CMD [ "node", "dist/index.js" ] 