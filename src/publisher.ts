import { connect } from "mqtt"; // import connect from mqtt
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
const args = process.argv.slice(2); // Slice the array to remove the first two elements (path to Node.js and the script file)
if (
  !process.env.TOPICTOREAD ||
  !process.env.MQTT_BROKER_URL ||
  !process.env.MQTT_USERNAME ||
  !process.env.MQTT_PASSWORD ||
  !process.env.CHECK_IF_UPDATE_NEEDED ||
  !process.env.READY_ON_SUCCESS ||
  !process.env.START_PAYMENT ||
  !process.env.CONFIRM_PAYMENT
) {
  throw new Error("env missing");
}
const client = connect("mqtts://" + process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
}); // create a client
const _topic = process.env.TOPICTOREAD;
const check_if_update_needed = process.env.CHECK_IF_UPDATE_NEEDED;
const ready_on_success = process.env.READY_ON_SUCCESS;
const start_payment = process.env.START_PAYMENT;
const consfirm_payment = process.env.CONFIRM_PAYMENT;

let data = "";
if (args[0] === "check") {
  data = check_if_update_needed;
} else if (args[0] === "ready") {
  data = ready_on_success;
} else if (args[0] === "pay") {
  data = start_payment;
} else if (args[0] === "confirmpayment") {
  data = consfirm_payment;
} else {
  console.error("arguments not found ", process.argv);
  data = "test";
}

client.on("connect", function () {
  // console.log(data);
  client.publish(_topic, data, () => {
    client.end();
  });
});
