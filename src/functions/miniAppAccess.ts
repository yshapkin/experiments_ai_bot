import "../telemetry.js";
import { app, type HttpRequest } from "@azure/functions";
import { loadRuntimeConfig } from "../config.js";
import { handleMiniAppAccess } from "../mini-app-access.js";
import { connectUserRepository } from "../users/repository.js";

const config = loadRuntimeConfig();
const users = connectUserRepository(config.tableEndpoint, config.managedIdentityClientId);
app.http("miniAppAccess", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "mini-app/access",
  handler: (request: HttpRequest) => handleMiniAppAccess(request, {
    token: config.telegramBotToken, origin: config.miniAppOrigin, users,
  }),
});
