import { initSocket } from "./src/services/socketIOClient";
import express from "express";
import http from "http";

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

import cors from "cors";

import { Socket } from "socket.io";
import "./src/db/mongoose";
import { socketAuthMiddleware } from "./src/middlewares/authMiddleware";
import errorHandler from "./src/middlewares/errorHandler";
import logger from "./src/middlewares/logMiddleware";
import notFoundHandler from "./src/middlewares/notFoundHandler";
import router from "./src/routes";

console.log("Server created");

const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

app.use("/api", logger);

app.use("/api", router);

app.use("/api", notFoundHandler);

app.use("/api", errorHandler);

io.use(socketAuthMiddleware);

io.on("connection", (socket: Socket) => {
  console.log("User connected", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
