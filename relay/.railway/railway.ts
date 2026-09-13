import { defineRailway, project, service } from "railway/iac";

/*
 * Orbit's relay, described in code. This replaces the deprecated
 * railway.json (Config as Code), which stops being read on 2026-12-01.
 *
 * The service name must stay `orbit-relay`: it is the existing service that
 * owns https://orbit-relay-production.up.railway.app. Renaming it here would
 * make Railway create a second service and the public URL would move.
 *
 * Restart policy is deliberately not declared. railway.json used to set
 * ON_FAILURE with 10 retries, which is exactly what Railway already does by
 * default - the dashboard shows On Failure / 10 - and the API reports those
 * fields as unset, so declaring them would leave `railway config plan`
 * permanently showing a change that can never be read back.
 */
export default defineRailway(() => {
  const orbitRelay = service("orbit-relay", {
    build: { builder: "NIXPACKS" },
    deploy: {
      startCommand: "npm start",
      healthcheckPath: "/health",
    },
    replicas: { sfo: 1 },
  });

  return project("orbit-relay", {
    resources: [orbitRelay],
  });
});
