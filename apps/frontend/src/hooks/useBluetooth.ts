import { useCallback, useMemo, useRef, useState } from "react";
import { bleService, IBluetoothService } from "../services/bluetoothService.ts";
import { BendBleCharUuids, BendBleServiceUuids } from "../types";

export type SamplePerSeconds = 1 | 10 | 20 | 50 | 100 | 200 | 333 | 500;
export type BluetoothState = "disconnected" | "paired";

export interface BluetoothContextType {
  state: BluetoothState;

  connect(
    options: RequestDeviceOptions,
    sampleRate: SamplePerSeconds,
    enableStretch: boolean
  ): Promise<void>;

  disconnect(): void;

  enableStretch(enable: boolean): Promise<void>;
}

const useBluetooth = (): BluetoothContextType => {
  const [state, setState] = useState<BluetoothState>("disconnected");
  const bluetoothServiceRef = useRef<IBluetoothService>(bleService);

  const connect = useCallback(
    async (
      options: RequestDeviceOptions,
      sampleRate: SamplePerSeconds,
      enableStretch: boolean
    ): Promise<void> => {
      if (!bluetoothServiceRef.current) {
        throw new Error("Bluetooth service not initialized.");
      }

      const paired = await bluetoothServiceRef.current.requestDevice(
        options,
        sampleRate,
        enableStretch
      );

      if (paired) {
        setState("paired");
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    if (!bluetoothServiceRef.current) {
      throw new Error("Bluetooth service not initialized.");
    }

    if (state === "disconnected") {
      throw new Error("Bluetooth is not paired.");
    }

    bluetoothServiceRef.current.disconnect();
    setState("disconnected");
  }, [state]);

  const enableStretch = useCallback(
    async (enable: boolean) => {
      if (!bluetoothServiceRef.current || state === "disconnected") {
        return;
      }

      const command = Uint8Array.of(enable ? 1 : 0, 0x80);
      await bluetoothServiceRef.current.writeCharacteristic(
        BendBleServiceUuids.ANGLE_SERVICE_UUID,
        BendBleCharUuids.ANGLE,
        command
      );
    },
    [state]
  );

  return useMemo(
    () => ({ state, connect, disconnect, enableStretch }),
    [state, connect, disconnect, enableStretch]
  );
};

export default useBluetooth;
