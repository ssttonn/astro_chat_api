import { StreamClient } from "@stream-io/node-sdk";

const streamAPIKey = process.env.STREAM_API_KEY as string;
const streamAPISecret = process.env.STREAM_API_SECRET as string;

const StreamIOClient = new StreamClient(streamAPIKey, streamAPISecret);

export default StreamIOClient;
