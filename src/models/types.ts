import { Request } from "express";
import { DefaultEventsMap, Socket } from "socket.io";
import { EventsMap } from "socket.io/dist/typed-events";
import * as core from "express-serve-static-core";

export interface TokenPayload {
  _id: string;
  email: string;
}

export interface AuthenticatedRequest<
  P = core.ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = core.Query,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  authUser?: TokenPayload;
}

export interface AuthenticatedSocket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
  SocketData = any
> extends Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData> {
  authUser?: TokenPayload;
}

export interface PaginationRequest {
  limit: number;
  page: number;
}
