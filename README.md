# govee-assistant
Home assistant implementation for govee lightbulbs

## Configuration

Edit the `config.yaml` file to configure your Govee Assistant:

```yaml
options:
  govee_api_key: "your-govee-api-key-here"
  mqtt_broker: "mqtt://localhost:1883"
  mqtt_user: "your_mqtt_user"
  mqtt_pass: "your_mqtt_pass"
```

### Required Settings:
- `govee_api_key`: Your Govee API key (get it from [Govee Developer Portal](https://developer.govee.com))

### Optional Settings:
- `mqtt_broker`: MQTT broker address (default: `mqtt://localhost:1883`)
- `mqtt_user`: MQTT username (optional)
- `mqtt_pass`: MQTT password (optional)

## Features

- **MQTT Control**: Control your Govee lights via MQTT commands
- **Home Assistant Discovery**: Automatically discovered in Home Assistant
- **State Publishing**: Device states are published back to MQTT
- **REST API**: Query devices via HTTP endpoint

## Usage

1. Update your `config.yaml` with your API key and MQTT settings
2. Run the application:
   ```bash
   node index.js
   ```
3. Devices will be automatically discovered in Home Assistant
4. Control lights by publishing to `govee/{deviceId}/set` with `ON` or `OFF`

