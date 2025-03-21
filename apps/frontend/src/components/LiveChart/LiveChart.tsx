import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { StreamPayload, StreamSubscription } from "../../types";

const MAX_POINTS = 50; // Adjust for smoother sliding effect

type Props = { dataStream: StreamSubscription };

const LiveChart = ({ dataStream }: Props) => {
  const [data, setData] = useState<StreamPayload[]>([]);

  useEffect(() => {
    const unsubscribe = dataStream.subscribe((newData) => {
      setData((prev) => {
        const updatedData = [...prev, newData];
        return updatedData.length > MAX_POINTS
          ? updatedData.slice(1)
          : updatedData;
      });
    });

    return () => unsubscribe();
  }, [dataStream]);

  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="timestamp"
        tickFormatter={(tick) => new Date(tick).toLocaleTimeString()}
      />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} />
      <Line type="monotone" dataKey="value2" stroke="#a067f8" dot={false} />
    </LineChart>
  );
};

export default LiveChart;
