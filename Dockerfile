FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server code
COPY server.js ./

# Create videos directory (will be used for uploads)
RUN mkdir -p videos

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
