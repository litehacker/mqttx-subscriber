To use the [`pm2-subscriber-conf.json`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FC%3A%2FUsers%2Fnatce%2FOneDrive%2FDocuments%2FGitHub%2Fmqttx-subscriber%2Fpm2-subscriber-conf.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "c:\\Users\natce\OneDrive\Documents\GitHub\mqttx-subscriber\pm2-subscriber-conf.json") file with PM2, you can follow these steps:

1. **Install PM2**: If you haven't already installed PM2, you can do so by running `npm install pm2 -g` in your terminal. This installs PM2 globally on your system, allowing you to use it from any directory.

2. **Place the Configuration File**: Ensure that the [`pm2-subscriber-conf.json`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FC%3A%2FUsers%2Fnatce%2FOneDrive%2FDocuments%2FGitHub%2Fmqttx-subscriber%2Fpm2-subscriber-conf.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "c:\\Users\natce\OneDrive\Documents\GitHub\mqttx-subscriber\pm2-subscriber-conf.json") file is in the root directory of your project or in a location where you intend to run PM2. This file contains the configuration for your application, including the name, script to run, and any arguments.

3. **Start the Application with PM2**: Navigate to the directory where your [`pm2-subscriber-conf.json`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2FC%3A%2FUsers%2Fnatce%2FOneDrive%2FDocuments%2FGitHub%2Fmqttx-subscriber%2Fpm2-subscriber-conf.json%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%5D "c:\\Users\natce\OneDrive\Documents\GitHub\mqttx-subscriber\pm2-subscriber-conf.json") file is located. Then, use the following command to start your application using the configuration file:

```shell
pm2 start pm2-subscriber-conf.json
```

This command tells PM2 to read the configuration from your `pm2-subscriber-conf.json` file and start the application based on the settings defined within. In your case, it will start the application named "subscriber" using `npm run start:prod` as specified in the "script" and "args" fields.

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
