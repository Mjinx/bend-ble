export type StreamPayload = { timestamp: number; value: number };
export type StreamSubscription = {
  subscribe: (callback: { (data: StreamPayload): void }) => () => void;
};

export const BendBleServiceUuids = {
  GENERIC_ACCESS_UUID: "00001800-0000-1000-8000-00805f9b34fb",
  BATTERY_SERVICE_UUID: "0000180f-0000-1000-8000-00805f9b34fb",
  INFO_SERVICE_UUID: "0000180a-0000-1000-8000-00805f9b34fb",
  ANGLE_SERVICE_UUID: "00001820-0000-1000-8000-00805f9b34fb",
  BEND_SERVICE_UUID: "00001823-0000-1000-8000-00805f9b34fb",
  FM_ANGLE_SERVICE_UUID: "00001900-0000-1000-8000-00805f9b34fb",
  FM_SERVICE_UUID: "00001801-0000-1000-8000-00805f9b34fb"
};

export const BendBleCharUuids = {
  BATTERY_LEVEL: "00002a19-0000-1000-8000-00805f9b34fb",
  ANGLE: "00002a70-0000-1000-8000-00805f9b34fb",
  INFO_FIRMWARE_REV: "00002a26-0000-1000-8000-00805f9b34fb",
  INFO_HARDWARE_REV: "00002a27-0000-1000-8000-00805f9b34fb",
  INFO_SOFTWARE_REV: "00002a28-0000-1000-8000-00805f9b34fb",
  INFO_MFG_NAME: "00002a29-0000-1000-8000-00805f9b34fb",
  INFO_SENSOR_TYPE: "00002a24-0000-1000-8000-00805f9b34fb",
  GAP_APPEARANCE: "00002a01-0000-1000-8000-00805f9b34fb",
  GAP_PRIVACY_FLAG: "00002a02-0000-1000-8000-00805f9b34fb",
  GAP_PREFERRED_CONNECTION_PARAMS: "00002a04-0000-1000-8000-00805f9b34fb",
  GAP_DEVICE_NAME: "00002a00-0000-1000-8000-00805f9b34fb"
};
