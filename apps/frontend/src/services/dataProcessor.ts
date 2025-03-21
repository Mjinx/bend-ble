import { StreamPayload } from "../types";

export class DataProcessor {
  private buffer: [number, number][] = [];
  private startTime: number = 0;
  private finalData: StreamPayload[] = [];

  constructor(private readonly interval: number = 2000) {}

  addSample({ timestamp, value, value2 }: StreamPayload) {
    if (this.startTime === 0) {
      this.startTime = timestamp;
    }
    if (timestamp - this.startTime < this.interval) {
      this.buffer.push([value, value2]);
    } else {
      this.processWindow();
      this.startTime = timestamp;
      this.buffer = [[value, value2]];
    }
  }

  processWindow() {
    const len = this.buffer.length;
    if (len <= 0) {
      return;
    }
    const avgValue = this.buffer.reduce(
      (sum, [value1, value2]) => [sum[0] + value1, sum[1] + value2],
      [0, 0]
    );
    this.finalData.push({
      timestamp: this.startTime,
      value: avgValue[0] / len,
      value2: avgValue[1] / len
    });
  }

  getCSV() {
    this.processWindow(); // Ensure last window is processed
    const header = "Timestamp,Value,Stretch\n";
    const rows = this.finalData
      .map((d) => `${d.timestamp},${d.value},${d.value2}`)
      .join("\n");
    return header + rows;
  }

  downloadCSV(filename = "data.csv") {
    const csvContent = this.getCSV();
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
