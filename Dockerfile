# Step 1: Use an official Node.js runtime as a base image
FROM node:18-alpine

# Step 2: Set the working directory inside the container
WORKDIR /usr/app

# Step 3: Copy the package.json and package-lock.json files
COPY package*.json ./

# Step 4: Install dependencies inside the container
RUN npm install

# Step 5: Copy the rest of your application code into the container
COPY . .

# Step 6: Expose the application port
EXPOSE 3000

# Step 7: Start the application
CMD ["npm", "start"]
