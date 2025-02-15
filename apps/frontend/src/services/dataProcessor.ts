import { StreamPayload } from "../types";

export class DataProcessor {
  private buffer: number[] = [];
  private startTime: number = 0;
  private finalData: StreamPayload[] = [];

  constructor(private readonly interval: number = 2000) {}

  addSample({ timestamp, value }: StreamPayload) {
    if (this.startTime === 0) {
      this.startTime = timestamp;
    }
    if (timestamp - this.startTime < this.interval) {
      this.buffer.push(value);
    } else {
      this.processWindow();
      this.startTime = timestamp;
      this.buffer = [value];
    }
  }

  processWindow() {
    const len = this.buffer.length;
    if (len <= 0) {
      return;
    }
    const avgValue = this.buffer.reduce((sum, val) => sum + val, 0) / len;
    this.finalData.push({ timestamp: this.startTime, value: avgValue });
  }

  getCSV() {
    this.processWindow(); // Ensure last window is processed
    const header = "Timestamp,Value\n";
    const rows = this.finalData
      .map((d) => `${d.timestamp},${d.value}`)
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
