import globalEventEmitter from "../../event-emitter.ts";
import { EVENT_NAME } from "../../services/bluetoothService.ts";
import { StreamSubscription } from "../../types";

export const bluetoothStream: StreamSubscription = {
  subscribe: (callback) => {
    console.log("subscribe bluetoothStream listener");
    const abortCtrl = new AbortController();

    const listener = (event: Event) => callback((event as CustomEvent).detail);
    globalEventEmitter.addEventListener(EVENT_NAME, listener, {
      signal: abortCtrl.signal
    });

    return () => {
      console.log("unsubscribe bluetoothStream listener");
      abortCtrl.abort("unsubscribe bluetoothStream");
    };
  }
};
