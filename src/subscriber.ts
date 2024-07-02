import { MqttClient, connect } from "mqtt"; // import connect from mqtt
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { Response, checkTerminalUpdate, payForRide } from "./provider";
import EventEmitter from "node:events";
import { Message } from "./types";
import { getSubscriptionFee } from "./provider/send-terminal-config";
const TerminalResponseStatus = {
  200: { value: "<200!", description: "CONNECTION_CHECK_STATUS" },
  201: { value: "<201!", description: "GET_BALANCE_STATUS" },
  202: { value: "<202!", description: "PAYMENT_OK_STATUS" },
  210: { value: "<210!", description: "MEMBERSHIP_PASS_STATUS" },
  222: { value: "<222!", description: "GET_CONFIG" },
  291: { value: "<291!", description: "NO_BALANCE_STATUS" },
  293: { value: "<293!", description: "UNKNOWN_CARD_STATUS" },
  297: { value: "<297!", description: "CARD_IS_NOT_ACTIVE_STATUS" },
  494: { value: "<494!", description: "Terminal not found" },
};
dotenv.config();
if (
  !process.env.TOPICTOREAD ||
  !process.env.MQTT_BROKER_URL ||
  !process.env.MQTT_BROKER_USERNAME ||
  !process.env.MQTT_BROKER_PASSWORD ||
  !process.env.MQTT_BROKER_PORT
) {
  throw new Error("No TOPICTOREAD in env file");
}
const client = connect(
  "mqtts://" + process.env.MQTT_BROKER_URL + ":" + process.env.MQTT_BROKER_PORT,
  {
    clientId: "emqx_nodejs_" + Math.random().toString(16).substring(2, 8),
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
  }
); // create a client
const _topicRead = process.env.TOPICTOREAD;

const updatedDataChunks: {
  [key: string]: {
    chunks: string[];
    index: number;
    version: number;
    startTime: Date;
    lastAddress: string;
  };
} = {};

client.on("error", function (error) {
  console.log("error", error);
});
client.on("connect", function () {
  console.log("connected to broker");
  client.subscribe(_topicRead, function (err) {
    if (!err) {
      console.log("connected,_topicRead:", _topicRead);
    } else {
      console.log("error", String(err));
    }
  });
});

client.on("message", async function (topic, message) {
  try {
    const data: Message["payload"] = JSON.parse(message.toString("utf-8"));

    if (data.operationType === "check") {
      const terminal = {
        firmwareVersion: data.content.firmwareVersion,
        terminalID: data.content.terminalID,
      };
      if (terminal.firmwareVersion && terminal.terminalID)
        await checkTerminalUpdate(terminal)
          .then((response) => {
            if (response.update && response._firmware) {
              updatedDataChunks[terminal.terminalID] = {
                chunks: splitString(response._firmware.Code, 960),
                index: 0,
                version: response._firmware.Version,
                startTime: new Date(),
                lastAddress: response._firmware.LastAddress,
              };
              sendErase(
                client,
                terminal.terminalID,
                response._firmware.LastAddress
              );

              setTimeout(() => {
                if (
                  updatedDataChunks[terminal.terminalID] &&
                  updatedDataChunks[terminal.terminalID].index !==
                    updatedDataChunks[terminal.terminalID].chunks.length - 1
                ) {
                  delete updatedDataChunks[data.content.terminalID];
                  return;
                }
              }, 180000);
            } else {
              send200(client, terminal.terminalID);
            }
          })
          .catch((error) => {
            console.log(error);
            send200(client, terminal.terminalID);
          });
    } else if (data.operationType === "makepayment") {
      console.log("makepayment", data);
    } else if (
      data.operationType === "payment" &&
      data.content &&
      topic === _topicRead
    ) {
      if (!data.content.cardID) {
        console.log("missing ", data.content.cardID, data.content.userID);
        send400(client, data.content.terminalID);
        return;
      } else {
        const response = new Response(
          client,
          data.content.terminalID,
          data.content.cardID ?? "unknown",
          data.content.userID ?? "unknown",
          false
        );
        payForRide({ response });
      }
    } else if (data.operationType === "acknowledge") {
      if (data.content.status === "success") {
        // if update had started and yet in progress
        if (updatedDataChunks[data.content.terminalID]) {
          // update next index if more chunk exists if not send go
          if (
            updatedDataChunks[data.content.terminalID]?.chunks.length ===
            updatedDataChunks[data.content.terminalID]?.index
          ) {
            sendEnd(
              client,
              data.content.terminalID,
              updatedDataChunks[data.content.terminalID].version
            );
            delete updatedDataChunks[data.content.terminalID];
            return;
          }
          sendChunk(
            client,
            data.content.terminalID,
            updatedDataChunks[data.content.terminalID].chunks[
              updatedDataChunks[data.content.terminalID].index
            ],
            () => {
              updatedDataChunks[data.content.terminalID].index++;
            }
          );
        } else {
          send200(client, data.content.terminalID);
        }
      }
    } else if (data.operationType === "config") {
      getSubscriptionFee(data.content.terminalID)
        .then((fee) => {
          client.publish("t" + data.content.terminalID, "<222," + fee + "!", {
            qos: 2,
          });
          console.log("fee sent", fee);
        })
        .catch((e) => {
          client.publish(
            "t" + data.content.terminalID,
            TerminalResponseStatus["494"].value,
            {
              qos: 2,
            }
          );
          console.log(e);
        });
    }
  } catch (e) {
    console.log(e);
  }
});
function sendErase(client: MqttClient, id: string, lastAddress: string) {
  client.publish(
    "t" + id,
    "<ERASE " + lastAddress + "!",
    {
      qos: 2,
    },
    () => {
      console.log("erase sent", "t" + id, "<ERASE " + lastAddress + "!");
    }
  );
}
function sendChunk(
  client: MqttClient,
  id: string,
  chunk: string,
  callback: () => void
) {
  client.publish(
    "t" + id,
    "<" + chunk,
    {
      qos: 2,
    },
    callback
  );
}

function send400(client: MqttClient, id: string) {
  client.publish("t" + id, "<400R!", {
    qos: 2,
  });
}

function sendEnd(client: MqttClient, id: string, version: number) {
  client.publish("t" + id, "<END " + version + "!", {
    qos: 2,
  });
}

function sendConfig(client: MqttClient, terminalID: string, travelFee: number) {
  client.publish("t" + terminalID, "<222," + travelFee + "!", {
    qos: 2,
  });
}
function send200(client: MqttClient, id: string) {
  client.publish("t" + id, "<200R!", {
    qos: 2,
  });
}
function sendGo(client: MqttClient, id: string) {
  client.publish("t" + id, "<GO!", {
    qos: 2,
  });
}
function splitString(code: string, chunkSize: number): string[] {
  var numChunks = Math.floor(code.length / chunkSize); // Calculate the number of chunks
  var chunks = [];

  for (var i = 0; i < numChunks; i++) {
    var start = i * chunkSize;
    var end = start + chunkSize;
    chunks.push(code.substring(start, end));
  }

  // Handle the remaining characters
  var remainingChars = code.length % chunkSize;
  if (remainingChars > 0) {
    var lastChunk = code.substring(code.length - remainingChars);
    lastChunk = lastChunk.padEnd(chunkSize, "F");
    chunks.push(lastChunk);
  }

  return chunks;
}
