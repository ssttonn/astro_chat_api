import { initSocket } from ".//services/socketIOClient";
import express from "express";
import http from "http";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = initSocket(server);

import cors from "cors";
import { Socket } from "socket.io";
import "./db/mongoose";
import { socketAuthMiddleware } from "./middlewares/authMiddleware";
import errorHandler from "./middlewares/errorHandler";
import logger from "./middlewares/logMiddleware";
import notFoundHandler from "./middlewares/notFoundHandler";
import router from "./routes";
import helmet from "helmet";
import morgan from "morgan";

const port = process.env.PORT || 3000;

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(cors());

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
