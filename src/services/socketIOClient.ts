import { Server } from "socket.io";

let io: Server | null = null;

export const initSocket = (server: any): Server => {
  io = new Server(server);
  console.log("Socket.io initialized");
  return io;
};

export const getSocketInstance = (): Server => {
  if (!io) {
    throw new Error("Socket.io instance has not been initialized!");
  }
  return io;
};
