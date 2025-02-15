import { useCallback, useMemo, useRef, useState } from "react";
import { bleService, IBluetoothService } from "../services/bluetoothService.ts";

export type SamplePerSeconds = 1 | 10 | 20 | 50 | 100 | 200 | 333 | 500;
export type BluetoothState = "disconnected" | "paired";

export interface BluetoothContextType {
  state: BluetoothState;

  connect(
    options: RequestDeviceOptions,
    sampleRate: SamplePerSeconds
  ): Promise<void>;

  disconnect(): void;
}

const useBluetooth = (): BluetoothContextType => {
  const [state, setState] = useState<BluetoothState>("disconnected");
  const bluetoothServiceRef = useRef<IBluetoothService>(bleService);

  const connect = useCallback(
    async (
      options: RequestDeviceOptions,
      sampleRate: SamplePerSeconds
    ): Promise<void> => {
      if (!bluetoothServiceRef.current) {
        throw new Error("Bluetooth service not initialized.");
      }

      const paired = await bluetoothServiceRef.current.requestDevice(
        options,
        sampleRate
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

  return useMemo(
    () => ({ state, connect, disconnect }),
    [state, connect, disconnect]
  );
};

export default useBluetooth;
