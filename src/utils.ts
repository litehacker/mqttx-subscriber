import { MqttClient } from "mqtt";

export function sendErase(client: MqttClient, id: string, lastAddress: string) {
  client.publish(
    `t${id}`,
    `<ERASE ${lastAddress}!`,
    { qos: 2, retain: false },
    () => {
      console.log("Erase command sent:", `t${id}`, `<ERASE ${lastAddress}!`);
    }
  );
}

export function sendChunk(
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
      retain: false,
    },
    callback
  );
}

export function send400(client: MqttClient, id: string) {
  client.publish("t" + id, "<400R!", {
    qos: 2,
    retain: false,
  });
}

export function sendEnd(client: MqttClient, id: string, version: number) {
  client.publish("t" + id, "<END " + version + "!", {
    qos: 2,
    retain: false,
  });
}

export function sendConfig(
  client: MqttClient,
  terminalID: string,
  travelFee: number
) {
  client.publish("t" + terminalID, "<222," + travelFee + "!", {
    qos: 2,
  });
}
export function send200(client: MqttClient, id: string) {
  client.publish("t" + id, "<200R!", {
    qos: 2,
    retain: false,
  });
}
export function sendGo(client: MqttClient, id: string) {
  client.publish("t" + id, "<GO!", {
    qos: 2,
    retain: false,
  });
}
export function splitString(code: string, chunkSize: number): string[] {
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
