To start a TypeScript application using `ts-node` with PM2, you can use an ecosystem configuration file (`ecosystem.config.js`) or directly pass the command to PM2 using the `--interpreter` flag. Here's how you can do it using both methods:

### Using an Ecosystem Configuration File

1. **Create an `ecosystem.config.js` file** in your project root with the following content:

```javascript
module.exports = {
  apps: [
    {
      name: "my-ts-app",
      script: "node_modules/.bin/ts-node",
      args: "./src/subscriber.ts",
      interpreter: "none", // This tells PM2 to not use any specific interpreter
    },
  ],
};
```

2. **Start the application with PM2** by running:

```bash
pm2 start ecosystem.config.js
```

This method allows you to easily manage multiple applications and their configurations.

### Using the PM2 Command Directly

Alternatively, you can start your application directly with PM2 without creating an `ecosystem.config.js` file, using the `--interpreter` flag:

```bash
pm2 start node_modules/.bin/ts-node --interpreter none -- ./src/subscriber.ts
```

Here, you're telling PM2 to use `ts-node` as the script to run, with `none` as the interpreter (meaning it should just execute the script directly), and then specifying the path to your TypeScript file.

### Note

- Ensure `ts-node` and `typescript` are installed in your project. If not, you can install them using npm or yarn (`npm install ts-node typescript --save`).
- The `--interpreter none` option is used to tell PM2 not to prepend the command with `node`. Since `ts-node` is an executable that runs your TypeScript files, you don't need Node.js to run it explicitly.
- If you're using PM2 in a production environment, it's a good practice to compile your TypeScript to JavaScript and run the compiled code directly with Node.js. This approach improves performance and stability.

4. **Verify the Application is Running**: You can verify that your application has started successfully by running:

```shell
pm2 list
```

This command displays a list of all applications currently managed by PM2, including their status, CPU, and memory usage.

5. **Logs and Monitoring**: If you need to check the logs for your application, you can use:

```shell
pm2 logs subscriber
```

This command shows the real-time logs for the "subscriber" application. You can also monitor your application in real-time using:

```shell
pm2 monit
```

6. **Save the PM2 List**: To ensure that your application restarts automatically after a reboot, you can save the current list of applications managed by PM2:

```shell
pm2 save
```

7. **Setup Startup Script**: Finally, to automate the restart of your application upon system reboot, you can generate and execute a startup script provided by PM2:

```shell
pm2 startup
```

Follow the instructions provided by the `pm2 startup` command to set up PM2 to automatically start your application when your system boots up.

These steps should help you successfully deploy your application using PM2 with your [`pm2-subscriber-conf.json`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FC%3A%2FUsers%2Fnatce%2FOneDrive%2FDocuments%2FGitHub%2Fmqttx-subscriber%2Fpm2-subscriber-conf.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "c:\\Users\natce\OneDrive\Documents\GitHub\mqttx-subscriber\pm2-subscriber-conf.json") configuration file.
