let app;

export default async function handler(req, res) {
  if (!app) {
    const serverModule = await import('../backend/server.js');
    app = serverModule.default;
  }
  return app(req, res);
}
