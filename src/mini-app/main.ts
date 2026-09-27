import { createMiniAppInitializer } from "./app.js";

const initializeMiniApp = createMiniAppInitializer();
initializeMiniApp({
  host: globalThis,
  initializeScreen: () => {
    // The static screen markup is complete before this module executes.
  },
});
