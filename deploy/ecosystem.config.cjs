/** PM2 config for Windows Server (HTTP on port 4782). */
module.exports = {
  apps: [
    {
      name: "quality-audit",
      cwd: __dirname.replace(/[\\/]deploy$/, ""),
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 -p 4782",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "4782",
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
