ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js if not in base image
RUN apk add --no-cache nodejs npm

# Copy data for add-on
COPY package*.json ./
RUN npm install

COPY . .

CMD [ "node", "index.js" ]