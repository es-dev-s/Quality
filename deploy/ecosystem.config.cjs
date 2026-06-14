/** PM2 config for Windows Server (HTTP on port 4782). */
require("dotenv").config();

const port = process.env.PORT || "4782";

module.exports = {
  apps: [
    {
      name: "quality-audit",
      cwd: __dirname.replace(/[\\/]deploy$/, ""),
      script: "node_modules/next/dist/bin/next",
      args: `start --hostname 0.0.0.0 -p ${port}`,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: port,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
