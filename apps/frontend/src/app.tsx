import "./app.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import DropdownSelector, {
  SelectOption
} from "./components/Dropdown/DropdownSelector";
import { bluetoothStream } from "./components/LiveChart/BluetoothStream";
import LiveChart from "./components/LiveChart/LiveChart";
import useBluetooth, { SamplePerSeconds } from "./hooks/useBluetooth";
import { DataProcessor } from "./services/dataProcessor";
import { BendBleServiceUuids } from "./types";

const processor = new DataProcessor(2000); // 2-second window

const App = () => {
  const { state, connect, disconnect, enableStretch } = useBluetooth();
  const [selectedItem, setSelectedItem] = useState<SamplePerSeconds>(10);
  const [stretch, setStretch] = useState<boolean>(false);

  const handleSelectionChange = useCallback((value: SamplePerSeconds) => {
    setSelectedItem(value);
  }, []);

  const items: SelectOption<SamplePerSeconds>[] = useMemo(
    () => [
      { value: 1, display: "1 HZ" },
      { value: 10, display: "10 HZ" },
      { value: 20, display: "20 HZ" },
      { value: 50, display: "50 HZ" },
      { value: 100, display: "100 HZ" },
      { value: 200, display: "200 HZ" },
      { value: 333, display: "333 HZ" },
      { value: 500, display: "500 HZ" }
    ],
    []
  );

  const handleBleConnect = useCallback(async () => {
    const scanOptions: RequestDeviceOptions = {
      filters: [{ namePrefix: "ads_" }],
      optionalServices: [BendBleServiceUuids.ANGLE_SERVICE_UUID]
    };

    await connect(scanOptions, selectedItem, stretch);
  }, [connect, selectedItem, stretch]);

  const handleBleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleToggleStretch = useCallback(async () => {
    await enableStretch(!stretch);
    setStretch((previous) => !previous);
  }, [enableStretch, stretch]);

  const handleExport = () => {
    processor.downloadCSV();
  };

  useEffect(() => {
    const unsubscribe = bluetoothStream.subscribe((data) =>
      processor.addSample(data)
    );
    return () => unsubscribe();
  }, []);

  return (
    <>
      <h2>Bluetooth ({state})</h2>
      <div>
        <input
          type="checkbox"
          id="checkbox"
          checked={stretch}
          onChange={handleToggleStretch}
        />
        <label htmlFor="checkbox">Enable stretch measurement</label>
      </div>
      {
        {
          paired: state == "paired" && (
            <>
              <button type="button" onClick={handleBleDisconnect}>
                Disconnect from device
              </button>
              <button type="button" onClick={handleExport}>
                Export
              </button>
              <LiveChart dataStream={bluetoothStream} />;
            </>
          ),
          disconnected: state == "disconnected" && (
            <>
              <DropdownSelector<SamplePerSeconds>
                items={items}
                selectedItem={selectedItem}
                onSelect={handleSelectionChange}
              />
              <button type="button" onClick={handleBleConnect}>
                Connect to Device
              </button>
              <button type="button" onClick={handleExport}>
                Export
              </button>
            </>
          )
        }[state]
      }
    </>
  );
};

export default App;
