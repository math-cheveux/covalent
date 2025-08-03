import { Bridge, CovalentData } from "@covalent/common";
import { BridgeOpen, CallbackManager, CallbackManagerImpl } from "./callback";
import { Bridges } from "./bridges";

/**
 * Proxy decorator settings.
 *
 * @param group the name of the linked controller
 * @param mirror the name of common members to bind together
 * @param map dictionary describing how to bind the bridge instance to the proxy members
 */
export interface ProxySettings<P, B> {
  group: string;
  mirror?: {
    [K in keyof Partial<P>]-?: K extends keyof B
      ? B[K] extends Bridge.Send<CovalentData> | Bridge.Invoke<CovalentData, CovalentData>
        ? K
        : never
      : never;
  }[keyof P][];
  map?: (bridge: B) => {
    [K in keyof Partial<P>]: P[K] extends BridgeOpen<Bridge.Callback<infer Input, infer Output>>
      ? CallbackManager<Input, Output>
      : P[K];
  };
}

/**
 * This class decorator defines the settings of a covalent proxy.
 *
 * @param settings the proxy settings
 * @constructor
 */
export function Proxy<P, B>(settings: ProxySettings<P, B>) {
  return function <T extends new (...args: any[]) => any>(target: T) {
    if (!Bridges.isBound(settings.group)) {
      return target;
    }
    return class extends target {
      constructor(...args: any[]) {
        super(...args);
        const bridge: B = Bridges.bind(settings.group);
        if (settings.mirror) {
          for (const map of settings.mirror) {
            // @ts-expect-error
            this[map] = bridge[map];
          }
        }
        if (settings.map) {
          const map = settings.map(bridge);
          for (const mapKey in map) {
            const mapElement = map[mapKey];
            if (mapElement instanceof CallbackManagerImpl) {
              // @ts-expect-error
              this[mapKey] = (arg: unknown) => mapElement.open(arg);
            } else {
              // @ts-expect-error
              this[mapKey] = mapElement;
            }
          }
        }
      }
    };
  };
}
