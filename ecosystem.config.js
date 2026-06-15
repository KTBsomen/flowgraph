module.exports = {
  apps: [
    {
      name: "flowgraph-backend",
      script: "./server/server.js",
      interpreter: "bun",
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      }
    },
    {
      name: "flowgraph-worker",
      script: "./server/engine/run-worker.js",
      interpreter: "bun",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
