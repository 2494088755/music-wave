FROM node:20-slim

WORKDIR /app

# Copy backend package.json and install
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy all source files
COPY backend/ ./backend/

# Expose port
EXPOSE 3000

# Start
CMD ["node", "backend/server.js"]
