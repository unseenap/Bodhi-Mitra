import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { createSocketServer } from "./socket/index.js";
import { destroyMysql, initializeMysql } from "./database/client.js";
import { safeDatabaseTarget } from "./database/config.js";
import { startNotificationScheduler, stopNotificationScheduler } from "./services/notification.scheduler.js";
const httpServer = createServer(app); createSocketServer(httpServer);

async function start() {
  await initializeMysql();
  console.info(`MySQL connected to ${safeDatabaseTarget()}`);
  startNotificationScheduler();
  httpServer.listen(env.PORT, () =>
    console.info(`Bodhi-Mitra API listening on ${env.PORT}`),
  );
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down`);
  stopNotificationScheduler();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
  await destroyMysql();
  process.exit(0);
}

start().catch(error => {
  const errorCode = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "STARTUP_FAILED";
  console.error(`Database startup failed (${errorCode})`);
  void destroyMysql().finally(() => process.exit(1));
});
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
