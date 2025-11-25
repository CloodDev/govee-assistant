import express from 'express';
import { createServer } from 'http';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello, Govee Assistant!');
});

const server = createServer(app);

server.listen(port, () => {
  console.log(`Govee Assistant is running at http://localhost:${port}`);
});