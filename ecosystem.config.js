// PM2 process manager config.
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (to survive reboots)
module.exports = {
  apps: [
    {
      name: "pinterest-bot",
      script: "./src/index.js",
      cwd: __dirname,
      node_args: "",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
