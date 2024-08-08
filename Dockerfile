# Use the official Node.js image as the base image
FROM node:18.20.1

# Set the working directory
WORKDIR /astro_chat_api

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the application port
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]