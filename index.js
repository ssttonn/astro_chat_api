const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const SocketResponse = require("./src/utils/socketHandler");
const { socketAuthMiddleware } = require("./src/middlewares/authMiddleware");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

global.io = io;

const router = require("./src/routes");
const errorHandler = require("./src/middlewares/errorHandler");
const notFoundHandler = require("./src/middlewares/notFoundHandler");
const logger = require("./src/middlewares/logMiddleware");
require("./src/db/mongoose");

const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/api", (req, _, next) => {
  req.io = io;
  next();
});

app.use("/api", logger);

app.use("/api", router);

app.use("/api", notFoundHandler);

app.use("/api", errorHandler);

io.use(socketAuthMiddleware)

io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});


server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

