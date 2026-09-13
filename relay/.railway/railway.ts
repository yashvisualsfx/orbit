import { defineRailway, project, service } from "railway/iac";

/*
 * Orbit's relay, described in code. This replaces the deprecated
 * railway.json (Config as Code), which stops being read on 2026-12-01.
 *
 * The service name must stay `orbit-relay`: it is the existing service that
 * owns https://orbit-relay-production.up.railway.app. Renaming it here would
 * make Railway create a second service and the public URL would move.
 */
export default defineRailway(() => {
  const orbitRelay = service("orbit-relay", {
    build: { builder: "NIXPACKS" },
    deploy: {
      startCommand: "npm start",
      healthcheckPath: "/health",
      // The relay holds long-lived sockets; if it ever dies, bring it back.
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    replicas: { sfo: 1 },
  });

  return project("orbit-relay", {
    resources: [orbitRelay],
  });
});
