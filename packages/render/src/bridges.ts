import { IpcRendererEvent } from "electron";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { Bridge, CovalentData } from "@covalent/common";
import { BridgeOpen, CallbackManager, CallbackManagerImpl } from "./callback";
import { KeysOfType } from "./keys-of-type";

/**
 * Utility type to easily identify a proxy's observable linked to its bridge.
 */
export type BridgeOf<On> = On extends Bridge.On<infer Output> ? Observable<Output> : never;

export type BridgeOfOptions<Output extends CovalentData, Init extends Bridge.Invoke<CovalentData, Output>> = {
  defaultValue?: Output;
  init?: Init extends Bridge.Invoke<infer InitInput, Output>
    ? InitInput extends void
      ? Init
      : { invoke: Init; input: InitInput }
    : never;
};

/**
 * Utility class for manipulating bridge instances.
 */
export abstract class Bridges {
  public static readonly EXPOSE_KEY = "covalent:bridge";

  private static get BRIDGE() {
    return window[Bridges.EXPOSE_KEY as keyof Window];
  }

  /**
   * @param group the controller group to test
   * @return `true` if the controller is exposed by IPC, otherwise `false`
   */
  public static isBound(group: string): boolean {
    return this.BRIDGE?.[group];
  }

  /**
   * @param group the controller group
   * @param defaultApi the default values to use if the controller is not exposed
   * @return the instance of the bridge, linked to the passed group controller
   */
  public static bind<T>(group: string, defaultApi?: Partial<T>): T {
    let obj: unknown = {};
    if (Bridges.isBound(group)) {
      Object.keys(this.BRIDGE[group]).forEach((key) => {
        Object.defineProperty(obj, key, {
          value: this.BRIDGE[group][key],
          writable: false,
        });
      });
    } else {
      console.warn("BridgeFactory : Cannot get group bridge", group);
      obj = {};
      if (defaultApi) {
        Object.keys(defaultApi).forEach((key) => {
          Object.defineProperty(obj, key, {
            value: (...args: unknown[]) => {
              console.warn("%s.%s : Not in electron app", group, key);
              // @ts-expect-error key is indeed a key of defaultApi
              return defaultApi[key](...args);
            },
            writable: false,
          });
        });
      }
    }
    return obj as T;
  }

  /**
   * @param on the bridge endpoint
   * @param options the returned observable parameters
   * @return an observable bound to the passed `ON` endpoint
   */
  public static of<Output extends CovalentData, Init extends Bridge.Invoke<any, Output>>(
    on: Bridge.On<Output>,
    options?: BridgeOfOptions<Output, Init>,
  ): BridgeOf<Bridge.On<Output>> {
    const subject =
      options?.defaultValue != undefined
        ? new BehaviorSubject<Output>(options.defaultValue)
        : new Subject<Output>();

    Promise.resolve(
      options?.init
        ? this.getOnFirstValue(options.init).then((value) => subject.next(value))
        : null,
    ).finally(() => {
      on((event: Bridge.Event<IpcRendererEvent, Output>) => subject.next(event.value));
    });

    return subject.asObservable();
  }

  private static getOnFirstValue<Output extends CovalentData, Init extends Bridge.Invoke<CovalentData, Output>>(
    init: Required<BridgeOfOptions<Output, Init>>["init"]
  ): Promise<Output> {
    return typeof init === "object" ? init.invoke(init.input) : init()
  }

  /**
   * Create a callback manager.
   * It is named 'open' for Proxy map setting,
   * since the callback manager is encapsulated and only its open method is exposed by the decorator.
   *
   * @param bridge the proxy bridge
   * @param callbackKey the `CALLBACK` endpoint key in the bridge
   * @param defaultValue the default value of the observables that will be created
   * @return the callback manager instance
   */
  public static open<B, Input extends CovalentData, Output extends CovalentData>(
    bridge: B,
    callbackKey: Extract<KeysOfType<B, Bridge.Callback<Input, Output>>, string>,
    defaultValue?: Output,
  ): CallbackManager<Input, Output> {
    return new CallbackManagerImpl<B, Input, Output>(bridge, callbackKey, defaultValue);
  }

  private static readonly CACHE_MAP: Map<
    Bridge.Invoke<any, any>,
    Map<unknown, unknown>
  > = new Map();

  /**
   * Override an `INVOKE` function to implement a stored-value logic.
   * The original function is not altered.
   *
   * @param invoke the `INVOKE` function to override
   * @param options the cache options
   * @return the overridden function
   */
  public static cache<Input extends CovalentData, Output extends CovalentData>(
    invoke: Bridge.Invoke<Input, Output>,
    options?: {
      invalidate?: {
        duration?: number;
        callCount?: number;
      };
    },
  ): Bridge.Invoke<Input, Output> {
    const valueMap = new Map<Input, Output>();
    const callCount = new Map<Input, number>();
    const durationTimeout = new Map<Input, number>();

    const fn = async function (data: Input): Promise<Output> {
      // Count calls of the function.
      callCount.set(data, (callCount.get(data) ?? 0) + 1);
      if (
        options?.invalidate?.callCount != undefined &&
        callCount.get(data)! >= options.invalidate.callCount
      ) {
        valueMap.delete(data);
      }
      let value: Output;

      // Call IPC.
      if (!valueMap.has(data)) {
        // Invalidate
        callCount.delete(data);
        if (durationTimeout.has(data)) {
          window.clearTimeout(durationTimeout.get(data));
          durationTimeout.delete(data);
        }

        // Invoke
        value = await invoke(data);
        valueMap.set(data, value);

        if (options?.invalidate?.duration != undefined) {
          durationTimeout.set(
            data,
            window.setTimeout(() => {
              valueMap.delete(data);
            }, options.invalidate.duration),
          );
        }
      } else {
        value = valueMap.get(data)!;
      }

      return value;
    };

    this.CACHE_MAP.set(fn, valueMap);

    return fn;
  }

  /**
   * Reset the stored-value of an overridden `INVOKE` function.
   * @param fn the overridden function to reset
   */
  public static invalidateCache<Input extends CovalentData, Output extends CovalentData>(
    fn: Bridge.Invoke<Input, Output>,
  ) {
    this.CACHE_MAP.get(fn)?.clear();
  }

  /**
   * Reset the stored-value of all overridden `INVOKE` functions.
   */
  public static invalidateCaches() {
    this.CACHE_MAP.forEach((_value, key) => this.invalidateCache(key));
  }

  /**
   * Utility class for defining the default values of proxy class members.
   */
  public static readonly Default = class {
    public static Send(): Bridge.Send<CovalentData> {
      return () => {};
    }

    public static Invoke<Output extends CovalentData>(value?: Output): Bridge.Invoke<CovalentData, Output> {
      return () => Promise.resolve(value) as Promise<Output>;
    }

    public static Callback<Input extends CovalentData, Output extends CovalentData>(
      value?: Output,
    ): BridgeOpen<Bridge.Callback<Input, Output>> {
      return () => {
        return Promise.resolve(value !== undefined ? new BehaviorSubject<Output>(value) : new Subject<Output>());
      };
    }

    /* istanbul ignore next */
    private constructor() {}
  };

  /* istanbul ignore next */
  private constructor() {}
}
