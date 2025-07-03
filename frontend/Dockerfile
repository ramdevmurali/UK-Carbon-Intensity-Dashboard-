# frontend/Dockerfile

# Use an official Node runtime as a parent image
FROM node:16-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app
CMD ["npm", "start"]