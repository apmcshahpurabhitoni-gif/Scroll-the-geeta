// Freebuff Sites Worker: serve the static app, then the platform's asset handler.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
