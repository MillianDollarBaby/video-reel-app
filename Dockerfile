FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server code only (not client)
COPY server.js ./
COPY videos/ ./videos/

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
