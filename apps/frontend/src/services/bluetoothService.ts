import globalEventEmitter from "../event-emitter.ts";
import { SamplePerSeconds } from "../hooks/useBluetooth.ts";
import { BendBleCharUuids, BendBleServiceUuids, StreamPayload } from "../types";
import { exponentialBackoff, timeLog } from "../utility.ts";

export const EVENT_NAME = "BleNotification";

export interface IBluetoothService {
  requestDevice(
    options: RequestDeviceOptions,
    sampleRate: SamplePerSeconds
  ): Promise<boolean>;

  disconnect(): void;

  readCharacteristic<T>(
    serviceUuid: string,
    characteristicUuid: string,
    decoder: (data: DataView) => T
  ): Promise<T>;

  writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    value: BufferSource
  ): Promise<void>;
}

const bendBleAdsOneAxisAngleDecoder = (
  raw: DataView,
  context: { count: number }
) => {
  if (!context.count) {
    context.count = 0;
  }

  let d: {
    angle1?: number;
    stretch?: number;
  } = {};
  try {
    d = {
      angle1: +raw.getFloat32(0, true).toFixed(4),
      stretch: +raw.getFloat32(4, true).toFixed(4)
    };
  } catch {
    /* empty */
  }

  return {
    timestamp: Date.now(),
    ...d,
    count: context.count++
  };
};

export class BluetoothService implements IBluetoothService {
  device?: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  cachedServices: Record<
    string,
    Record<string, BluetoothRemoteGATTCharacteristic>
  > = {};
  private abortCtrl?: AbortController;
  private notifications: Record<string, AbortController> = {};
  private sampleRate: number = 10;

  async requestDevice(
    options: RequestDeviceOptions,
    sampleRate: SamplePerSeconds
  ): Promise<boolean> {
    if (this.abortCtrl != null) {
      this.abortCtrl.abort("request new device.");
    }

    this.sampleRate = sampleRate;

    options = options ?? {
      acceptAllDevices: true,
      optionalServices: [
        "generic_access",
        "device_information",
        "battery_service",
        "current_time",
        "human_interface_device"
      ]
    };

    const device = await navigator.bluetooth.requestDevice(options);

    if (!device) {
      throw new Error("No device selected.");
    }

    const { signal } = (this.abortCtrl = new AbortController());
    this.abortCtrl.signal.addEventListener("abort", () => {
      console.debug(`signal abort triggered: ${signal.reason}`);

      delete this.abortCtrl;
      delete this.device;
      delete this.server;
    });

    (device as EventTarget).addEventListener(
      "gattserverdisconnected",
      () => {
        this.onDisconnected();
      },
      { signal }
    );

    console.log(`Device selected: ${device.name}`);

    return await this.connect(device);
  }

  disconnect(): void {
    const service = this.server;

    this.cleanup();

    service?.disconnect();
  }

  async readCharacteristic<T>(
    serviceUuid: string,
    characteristicUuid: string,
    decoder: (data: DataView) => T
  ): Promise<T> {
    const characteristic = await this.getCharacteristics(
      serviceUuid,
      characteristicUuid
    );

    const value = await characteristic.readValue();

    return decoder(value);
  }

  // async startNotifications(
  //   topic: string,
  //   callback: BleCallback,
  // ): Promise<() => void> {
  //   const [serviceUuid, characteristicUuid] = topic.split("/");
  //   const characteristics =
  //     this.cachedServices.get(serviceUuid) ||
  //     (await this.discoverServicesAndCharacteristics(serviceUuid));
  //   if (characteristicUuid === "*") {
  //     const unsubscribeFns: (() => void)[] = [];
  //     for (const charUuid of characteristics.keys()) {
  //       const unsubscribe = await this.startNotifications(
  //         `${serviceUuid}/${charUuid}`,
  //         callback,
  //       );
  //       unsubscribeFns.push(unsubscribe);
  //     }
  //     return () => unsubscribeFns.forEach((fn) => fn());
  //   } else {
  //     const characteristic = characteristics.get(characteristicUuid);
  //     if (!characteristic || !characteristic.properties.notify) {
  //       throw new Error(
  //         `Cannot subscribe to notifications for characteristic ${characteristicUuid}`,
  //       );
  //     }
  //     const unsubscribe = this.pubSub.subscribe(topic, callback);
  //     const currentSubscribers = this.pubSub.getSubscribers(topic);
  //     if (currentSubscribers.size === 1) {
  //       await characteristic.startNotifications();
  //       characteristic.addEventListener(
  //         "characteristicvaluechanged",
  //         (event: Event) => {
  //           const target = event.target as BluetoothRemoteGATTCharacteristic;
  //           const value = target.value;
  //           if (value) {
  //             this.pubSub.publish(topic, {
  //               characteristic: target.uuid,
  //               value,
  //             });
  //           }
  //         },
  //       );
  //     }
  //     // Enhanced unsubscribe logic
  //     const originalUnsubscribe = unsubscribe;
  //     return () => {
  //       originalUnsubscribe();
  //       const remainingSubscribers = this.pubSub.getSubscribers(topic);
  //       if (remainingSubscribers.size === 0) {
  //         characteristic.stopNotifications();
  //       }
  //     };
  //   }
  // }

  async writeCharacteristic(
    serviceUuid: string,
    characteristicUuid: string,
    value: BufferSource
  ): Promise<void> {
    const characteristic = await this.getCharacteristics(
      serviceUuid,
      characteristicUuid
    );

    console.debug("Writing to characteristic", characteristic, value);
    await characteristic.writeValue(value);
    console.debug("Done writing to characteristic");
  }

  private cleanup(): void {
    if (this.abortCtrl != null) {
      this.abortCtrl.abort("cleanup reconnection");
      delete this.abortCtrl;
    }
    Object.getOwnPropertyNames(this.notifications).forEach((key) => {
      this.notifications[key].abort("cleanup notification");
    });

    delete this.device;
    delete this.server;

    this.clearCache();
  }

  private clearCache() {
    Object.getOwnPropertyNames(this.cachedServices).forEach((key) => {
      delete this.cachedServices[key];
    });
  }

  private async connect(device: BluetoothDevice) {
    return await exponentialBackoff(
      { max: 3, delay: 2 },
      async () => {
        await this.connectToDevice(device);

        const samples = Math.floor(16384 / this.sampleRate);
        const command1 = new Uint8Array([
          samples & 0xff,
          (samples >> 8) & 0xff
        ]);
        await this.writeCharacteristic(
          BendBleServiceUuids.ANGLE_SERVICE_UUID,
          BendBleCharUuids.ANGLE,
          command1
        );

        /*const command2 = Uint8Array.of(1, 0x80);
        await this.writeCharacteristic(
          BendBleServiceUuids.ANGLE_SERVICE_UUID,
          BendBleCharUuids.ANGLE,
          command2
        );*/

        await this.listenToAngleNotifications();
      },
      () => console.log("> Bluetooth Device connected..."),
      (error) => timeLog(`Failed to reconnect... ${error}`)
    );
  }

  private async connectToDevice(device: BluetoothDevice): Promise<void> {
    timeLog("Connecting to Bluetooth Device... ");

    if (device === null) {
      throw new Error(`No device is paired.`);
    }

    timeLog(`Connecting to GATT Server...`);

    const server = (await device.gatt?.connect()) ?? null;

    if (server == null || !server.connected) {
      throw new Error(`Failed to connect to device: ${device.name}`);
    }

    this.device = device;
    this.server = server;
  }

  /*private async cacheServices(
    server: BluetoothRemoteGATTServer
  ): Promise<void> {
    const label = `ServiceLookup`;
    console.time(label);
    try {
      console.timeLog(label, "Getting services...");

      const services = await server.getPrimaryServices();

      console.timeLog(label, `Discovered ${services.length} services`);
      for (const service of services) {
        /!*const name =
          {
            [BendBleServiceUuids.GENERIC_ACCESS_UUID]: "GenericAccess",
            [BendBleServiceUuids.BATTERY_SERVICE_UUID]: "Battery",
            [BendBleServiceUuids.INFO_SERVICE_UUID]: "Information",
            [BendBleServiceUuids.ANGLE_SERVICE_UUID]: "Angle",
            [BendBleServiceUuids.FM_ANGLE_SERVICE_UUID]: "FM_Angle",
            [BendBleServiceUuids.FM_SERVICE_UUID]: "FM"
          }[service.uuid] ?? "Unknown";*!/

        /!* console.log(
           `${service.uuid} >> Service: ${name}${service.isPrimary ? " (primary)" : " "}`
         );*!/

        const characteristics = await service.getCharacteristics();

        const characteristicMap: Record<
          string,
          BluetoothRemoteGATTCharacteristic
        > = {};

        for (const characteristic of characteristics) {
          /!*const charType =
            {
              [BendBleCharUuids.BATTERY_LEVEL]:
                BendBleBatteryServiceCharType.BatteryLevel,
              [BendBleCharUuids.ANGLE]: BendBleAngleServiceCharType.AdsAngle,
              [BendBleCharUuids.INFO_FIRMWARE_REV]:
                BendBleInfoServiceCharType.FirmwareRev,
              [BendBleCharUuids.INFO_HARDWARE_REV]:
                BendBleInfoServiceCharType.HardwareRev,
              [BendBleCharUuids.INFO_SOFTWARE_REV]:
                BendBleInfoServiceCharType.SoftwareRev,
              [BendBleCharUuids.INFO_MFG_NAME]:
                BendBleInfoServiceCharType.MfgName,
              [BendBleCharUuids.INFO_SENSOR_TYPE]:
                BendBleInfoServiceCharType.SensorType,
              [BendBleCharUuids.GAP_APPEARANCE]:
                BendBleGenericServiceCharType.Appearance,
              [BendBleCharUuids.GAP_PRIVACY_FLAG]:
                BendBleGenericServiceCharType.PrivacyFlag,
              [BendBleCharUuids.GAP_PREFERRED_CONNECTION_PARAMS]:
                BendBleGenericServiceCharType.PreferredConnectionParams,
              [BendBleCharUuids.GAP_DEVICE_NAME]:
                BendBleGenericServiceCharType.DeviceName
            }[characteristic.uuid] ?? "Unknown";*!/

          characteristicMap[characteristic.uuid] = characteristic;

          //const value = await bleUtility.readCharacteristicValues(characteristic);
          //const descriptors = await bleUtility.readCharacteristicDescriptors(characteristic);

          /!*console.log(
            `${characteristic.uuid} >> Characteristic: ${charType} ${this.getSupportedProperties(characteristic)}`,
            {
              value,
              descriptors
            }
          );*!/

          //console.groupEnd();
        }

        this.cachedServices[service.uuid] = characteristicMap;
        //console.groupEnd();
      }
    } catch (error) {
      console.error(`Failed to cache service characteristics, error: ${error}`);
      this.clearCache();
    } finally {
      //console.groupEnd();
      console.timeEnd(label);
    }
  }*/

  /*private getSupportedProperties(
    characteristic: BluetoothRemoteGATTCharacteristic
  ) {
    const supportedProperties = Object.keys(characteristic.properties).reduce(
      (acc, property) => {
        if (characteristic.properties[property]) {
          acc.push(property.toUpperCase());
        }
        return acc;
      },
      new Array<string>()
    );

    return "[" + supportedProperties.join(", ") + "]";
  }*/

  private onDisconnected(): void {
    if (!this.device) {
      console.debug("> Bluetooth Device disconnected.");
      return;
    }

    this.clearCache();

    console.debug("> Bluetooth Device disconnected, reconnecting...");
    this.connect(this.device!).then(
      () => console.debug("reconnected"),
      console.error
    );
  }

  private async discoverServicesAndCharacteristics(
    serviceUuid: string
  ): Promise<Record<string, BluetoothRemoteGATTCharacteristic>> {
    if (!this.server) {
      throw new Error("GATT server is not connected.");
    }

    const service = await this.server.getPrimaryService(serviceUuid);
    const characteristics = await service.getCharacteristics();
    const characteristicMap: Record<string, BluetoothRemoteGATTCharacteristic> =
      {};

    for (const characteristic of characteristics) {
      characteristicMap[characteristic.uuid] = characteristic;
    }

    this.cachedServices[serviceUuid] = characteristicMap;

    return characteristicMap;
  }

  private async listenToAngleNotifications() {
    const characteristic = await this.getCharacteristics(
      BendBleServiceUuids.ANGLE_SERVICE_UUID,
      BendBleCharUuids.ANGLE
    );

    if (!characteristic.properties.notify) {
      console.error("Unable to listen to notifications");
      return;
    }

    if (this.notifications[characteristic.uuid]) {
      this.notifications[characteristic.uuid].abort(
        "enabling notifications again"
      );
    }

    console.debug(`enable notification ${characteristic.uuid}`);
    const context = { count: 0 };

    try {
      const onDataNotification = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const data = bendBleAdsOneAxisAngleDecoder(target.value!, context);
        globalEventEmitter.dispatchEvent(
          new CustomEvent<StreamPayload>(EVENT_NAME, {
            detail: { timestamp: data.timestamp, value: data.angle1 ?? 0 }
          })
        );
      };

      const { signal } = (this.notifications[characteristic.uuid] =
        new AbortController());

      signal.addEventListener("abort", () => {
        console.debug(`signal abort triggered: ${signal.reason}`);
        delete this.notifications[characteristic.uuid];
      });

      (characteristic as EventTarget).addEventListener(
        "characteristicvaluechanged",
        onDataNotification,
        { signal }
      );
      await characteristic.startNotifications();
    } catch (error) {
      console.warn("failed to start notifications", error);
    }
    return;
  }

  private async getCharacteristics(
    serviceUuid: string,
    characteristicUuid: string
  ) {
    const characteristics =
      this.cachedServices[serviceUuid] ||
      (await this.discoverServicesAndCharacteristics(serviceUuid));

    const characteristic = characteristics[characteristicUuid];
    if (!characteristic) {
      throw new Error(`Characteristic ${characteristicUuid} not found.`);
    }

    return characteristic;
  }
}

export const bleService = new BluetoothService();
