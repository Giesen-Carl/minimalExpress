# Step 1: Use an official Node.js runtime as a base image
FROM node:18-alpine

# ENV DATABASE_URL=postgres://admin:B6jHHjDT4S7x37xNbPi@postgres:5432/express_db
ARG POSTGRES_DB=express_db
ARG POSTGRES_USER=admin
ARG POSTGRES_PASSWORD
ARG PASSWORD_HASH_SECRET

# Set environment variables for the default user, password, and database
ENV NODE_ENV=production
ENV POSTGRES_USER=$POSTGRES_USER
ENV POSTGRES_DB=$POSTGRES_DB
ENV POSTGRES_PASSWORD=$POSTGRES_PASSWORD
ENV PASSWORD_HASH_SECRET=$PASSWORD_HASH_SECRET

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
