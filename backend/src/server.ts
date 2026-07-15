import { createServer } from "node:http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { createSocketServer } from "./socket/index.js";
const httpServer = createServer(app); createSocketServer(httpServer);
mongoose.connect(env.MONGODB_URI).then(() => httpServer.listen(env.PORT, () => console.info(`Bodhi-Mitra API listening on ${env.PORT}`))).catch(error => { console.error("Database connection failed", error); process.exit(1); });
async function shutdown() { await mongoose.disconnect(); httpServer.close(() => process.exit(0)); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
