const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const fs = require('fs');
const yaml = require('js-yaml');
const app = express();
const port = 30120;

// Load configuration from YAML file
let config;
try {
  const configFile = fs.readFileSync('./config.yaml', 'utf8');
  const configData = yaml.load(configFile);
  config = configData.options || {};
} catch (error) {
  console.error('Error loading config.yaml:', error);
  process.exit(1);
}

// Configuration from config.yaml
const GOVEE_API_KEY = config.govee_api_key;
const MQTT_BROKER = config.mqtt_broker || 'mqtt://localhost:1883';
const MQTT_USER = config.mqtt_user;
const MQTT_PASS = config.mqtt_pass;

if (!GOVEE_API_KEY) {
  console.error('Error: govee_api_key is required in config.yaml');
  process.exit(1);
}

const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS
});

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  publishDevicesToHomeAssistant();
  subscribeToDeviceCommands();
});

mqttClient.on('message', async (topic, message) => {
  console.log(`Received message on ${topic}: ${message.toString()}`);

  // Extract device ID from topic (govee/{deviceId}/set)
  const match = topic.match(/^govee\/([^\/]+)\/set$/);
  if (!match) return;

  const deviceId = match[1];
  const command = message.toString();

  // Convert device ID back to format with colons
  const formattedDeviceId = deviceId.match(/.{1,2}/g).join(':');

  try {
    await controlDevice(formattedDeviceId, command);
  } catch (error) {
    console.error(`Error controlling device ${formattedDeviceId}:`, error);
  }
});

async function publishDevicesToHomeAssistant() {
  try {
    const response = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      method: 'GET',
      headers: {
        'Govee-API-Key': GOVEE_API_KEY
      }
    });
    const data = await response.json();

    const devices = data.data?.filter(device =>
      device.sku !== 'BaseGroup' && device.sku !== 'DreamViewScenic'
    ) || [];

    devices.forEach(device => {
      const uniqueId = device.device.replace(/:/g, '');
      const discoveryTopic = `homeassistant/light/govee_${uniqueId}/config`;

      const config = {
        name: device.deviceName,
        unique_id: `govee_${uniqueId}`,
        state_topic: `govee/${uniqueId}/state`,
        command_topic: `govee/${uniqueId}/set`,
        payload_on: 'ON',
        payload_off: 'OFF',
        device: {
          identifiers: [uniqueId],
          name: device.deviceName,
          model: device.sku,
          manufacturer: 'Govee'
        }
      };

      mqttClient.publish(discoveryTopic, JSON.stringify(config), { retain: true });
    });
  } catch (error) {
    console.error('Error publishing to Home Assistant:', error);
  }
}

async function subscribeToDeviceCommands() {
  try {
    const response = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      method: 'GET',
      headers: {
        'Govee-API-Key': GOVEE_API_KEY
      }
    });
    const data = await response.json();

    const devices = data.data?.filter(device =>
      device.sku !== 'BaseGroup' && device.sku !== 'DreamViewScenic'
    ) || [];

    devices.forEach(device => {
      const uniqueId = device.device.replace(/:/g, '');
      const commandTopic = `govee/${uniqueId}/set`;
      mqttClient.subscribe(commandTopic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${commandTopic}:`, err);
        } else {
          console.log(`Subscribed to ${commandTopic}`);
        }
      });
    });
  } catch (error) {
    console.error('Error subscribing to device commands:', error);
  }
}

async function controlDevice(deviceId, command) {
  const turnOn = command === 'ON';

  const payload = {
    requestId: `mqtt-${Date.now()}`,
    payload: {
      sku: null, // Will be filled from device lookup if needed
      device: deviceId,
      capability: {
        type: 'devices.capabilities.on_off',
        instance: 'powerSwitch',
        value: turnOn ? 1 : 0
      }
    }
  };

  console.log(`Sending command to Govee API: ${command} for device ${deviceId}`);

  const response = await fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
    method: 'POST',
    headers: {
      'Govee-API-Key': GOVEE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  console.log('Govee API response:', result);

  // Publish state back to MQTT
  const uniqueId = deviceId.replace(/:/g, '');
  const stateTopic = `govee/${uniqueId}/state`;
  mqttClient.publish(stateTopic, command, { retain: true });

  return result;
}

app.get('/', (req, res) => {
  fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
    method: 'GET',
    headers: {
      'Govee-API-Key': GOVEE_API_KEY
    }
  })
    .then(response => response.json())
    .then(data => {
      const formatted = {
        totalDevices: data.data?.filter(device => device.sku !== 'BaseGroup' && device.sku !== 'DreamViewScenic').length || 0,
        devices: data.data?.filter(device => device.sku !== 'BaseGroup' && device.sku !== 'DreamViewScenic').map(device => ({
          name: device.deviceName,
          model: device.sku,
          id: device.device,
          controllable: device.controllable,
          retrievable: device.retrievable,
          capabilities: device.capabilities
        })) || []
      };
      res.json(formatted);
    })
    .catch(error => {
      console.error('Error fetching Govee devices:', error);
      res.status(500).send('Error fetching Govee devices');
    });
});

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Govee Assistant is running at http://localhost:${port}`);
});
