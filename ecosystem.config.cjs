/** PM2 production config — run: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "hrms-frontend",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3030",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3030,
        API_TLS_REJECT_UNAUTHORIZED: "false",
      },
    },
  ],
};
