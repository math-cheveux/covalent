import { Observable } from "rxjs";
import { Bridge, CovalentData } from "@covalent/common";
import { BridgeType } from "./bridge-type.enum";
import { Handler } from "./handler";
import { Constructor, Controllers, WebContents } from "./ipc";
import { CallbackManager, CallbackManagerHandler } from "./callback";
import { ReflectUtils } from "./reflect-utils";
import "reflect-metadata";

/**
 * Interface to use on a covalent controller when it needs an asynchronous initialization step.
 */
export interface OnInit {
  /**
   * Method called when all the controllers are instantiated.
   * It is called asynchronously alongside the other controllers initialization,
   * so you may use <code>Controllers.waitInit</code> if you need another controller to be initialized first.
   */
  onCovalentInit: () => void | PromiseLike<void>;
}

/**
 * Controller decorator settings.
 *
 * @param group the name used to identify the controller
 * @param bridge the map to identify bridge methods type
 * @param handlers the callbacks called when the controller receives a message from a render process
 * @param triggers the automatic gateways to render processes linked to an observable
 */
export interface ControllerSettings<C, B> {
  group: string;
  bridge: Record<keyof B, BridgeType>;
  handlers: (
    self: C,
  ) => {
    [K in keyof B as B[K] extends Bridge.Send<CovalentData> | Bridge.Invoke<CovalentData, CovalentData> | Bridge.Callback<CovalentData, CovalentData> ? K : never]:
    B[K] extends Bridge.Invoke<infer I, infer O> ? Handler.Invoke<I, O>
      : B[K] extends Bridge.Send<infer I> ? Handler.Send<I>
        : B[K] extends Bridge.Callback<infer I, infer O> ? CallbackManagerHandler<I, O>
          : never;
  };
  triggers: (self: C) => {
    [K in keyof B as B[K] extends Bridge.On<CovalentData> ? K : never]:
    B[K] extends Bridge.On<infer O> ? Observable<O> : never;
  };
}

/**
 * This class decorator defines the settings of a covalent controller.
 * This decorator may be used for the following cases:
 * - The decorated controller constructor has other controllers as parameter.
 * - The decorated controller is exposed in the preload file.
 *
 * @param settings the controller settings
 * @constructor
 */
export function Controller<C, B>(settings: ControllerSettings<C, B>) {
  function getChannel(group: string, key: string) {
    return group + ":" + key;
  }

  return function <T extends Constructor>(target: T) {
    const { group, bridge, handlers, triggers } = settings;
    const metadataBridge = Object.keys(bridge).reduce((finalBridge, key) => {
      finalBridge[key] = (bridge[key as keyof B] as BridgeType).bridge(getChannel(group, key));
      if (bridge[key as keyof B] === BridgeType.CALLBACK) {
        finalBridge[key + ":__close"] = BridgeType.SEND.bridge(getChannel(group, key + ":__close"));
      }
      return finalBridge;
    }, {} as any);
    Reflect.defineMetadata(Controllers.BRIDGE_METADATA_PREFIX + group, metadataBridge, target);
    return class extends target {
      // @ts-ignore
      static readonly name = target.name;

      constructor(...args: any[]) {
        super(
          ...(Reflect.getMetadata("design:paramtypes", target) || []).map(
            (data: any, i: number) => Controllers.getSync(data) ?? args?.[i],
          ),
        );
        const selfHandlers: ReturnType<ControllerSettings<C, B>["handlers"]> = handlers(this as unknown as C);
        for (const handlerKey in selfHandlers) {
          const handler = selfHandlers[handlerKey];
          if (bridge[handlerKey] !== BridgeType.CALLBACK) {
            bridge[handlerKey].handler!(getChannel(group, handlerKey), handler.bind(this) as any);
          } else {
            ReflectUtils.computeMetadataIfAbsent(
              Controllers.CALLBACK_MANAGERS_METADATA_KEY,
              target,
              () => new Map<string, CallbackManager<CovalentData, CovalentData>>(),
            ).set(
              handlerKey,
              new CallbackManager(
                getChannel(group, handlerKey),
                handler.bind(this) as CallbackManagerHandler<CovalentData, CovalentData>,
              ),
            );
          }
        }
        const selfTriggers: ReturnType<ControllerSettings<C, B>["triggers"]> = triggers(this as unknown as C);
        for (const triggerKey in selfTriggers) {
          Controllers.storeSubscriptionForDisposal(
            selfTriggers[triggerKey].subscribe((next: any) => WebContents.send(getChannel(group, triggerKey), next))
          );
        }
      }
    };
  };
}
