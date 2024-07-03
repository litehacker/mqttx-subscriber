module.exports = {
  apps: [
    {
      name: "subscriber",
      script: "node_modules/.bin/ts-node",
      args: "./src/subscriber.ts",
      interpreter: "none", // This tells PM2 to not use any specific interpreter
    },
  ],
};
