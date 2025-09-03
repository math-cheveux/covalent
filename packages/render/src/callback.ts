import { BehaviorSubject, Observable, Subject } from "rxjs";
import { Bridge, CovalentData } from "@electron-covalent/common";
import { KeysOfType } from "./keys-of-type";

export interface CallbackObservable<T> extends Observable<T> {
  complete(): void;
}

export type CallbackOptions<Output extends CovalentData> = {
  defaultValue: Output;
  init?: PromiseLike<Output>;
};

export type BridgeOpen<Callback> =
  Callback extends Bridge.Callback<infer Input, infer Output>
    ? (input?: Input, options?: CallbackOptions<Output>) => CallbackObservable<Output>
    : never;

/**
 * Type for 'callback' message handlers.
 */
export interface CallbackManager<Input extends CovalentData, Output extends CovalentData> {
  /**
   * Send a request to open a communication channel and return an observable linked to this channel.
   *
   * @param input the callback input
   * @param options the callback options
   * @return the callback observable
   */
  open(input?: Input, options?: CallbackOptions<Output>): CallbackObservable<Output>;
}

export class CallbackManagerImpl<B, Input extends CovalentData, Output extends CovalentData>
  implements CallbackManager<Input, Output> {
  public constructor(
    private readonly bridge: B,
    private readonly callbackKey: Extract<KeysOfType<B, Bridge.Callback<Input, Output>>, string>,
    private readonly defaultValue?: Output,
  ) {}

  private get callback(): Bridge.Callback<Input, Output> {
    return this.bridge[this.callbackKey] as Bridge.Callback<Input, Output>;
  }

  private get close(): Bridge.Send<number> {
    return this.bridge[(this.callbackKey + ":__close") as keyof B] as Bridge.Send<number>;
  }

  public open(input: Input, options?: CallbackOptions<Output>): CallbackObservable<Output> {
    const subject = options ? new BehaviorSubject<Output>(options.defaultValue) : new Subject<Output>();

    Promise.resolve(options?.init?.then((value) => subject.next(value)))
      .finally(() => {
        const closingPort = this.callback((event) => subject.next(event.value), input);

        subject.subscribe({ complete: () => this.close(closingPort) });
      });

    return subject;
  }
}
