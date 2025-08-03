import { Subject } from "rxjs";
import { CovalentData } from "@electron-covalent/common";
import { Main } from "./ipc";
import { Handler } from "./handler";

export type CallbackPort<Input extends CovalentData, Output extends CovalentData> = {
  id: number;
  input: Input;
  postMessage: (data: Output) => void;
  close: () => void;
  onClose: (listener: () => void) => void;
};

export class CallbackManager<Input extends CovalentData, Output extends CovalentData> {
  private readonly ports: CallbackPort<Input, Output>[] = [];

  constructor(callbackKey: string, private readonly handler: CallbackManagerHandler<Input, Output>) {
    Main.on<number>(callbackKey + ":__close", this.unwatch.bind(this));
    Main.onMessagePort<Input, Output>(callbackKey, this.watch.bind(this));
  }

  public watch: Handler.Callback<Input, Output> = (replyPort: CallbackPort<Input, Output>) => {
    this.ports.push(replyPort);
    const subject = new Subject<Output>();
    subject.subscribe((next) => replyPort.postMessage(next));
    replyPort.onClose(/* istanbul ignore next */ () => {
      subject.unsubscribe();
    });
    this.handler(subject, replyPort.input);
  };

  public unwatch(portId: number): void {
    const index = this.ports.findIndex((port) => port.id === portId);
    if (index >= 0) {
      this.ports.splice(index, 1)[0].close();
    }
  }

  public unwatchAll(): void {
    for (const port of this.ports.splice(0)) {
      port.close();
    }
  }
}

export type CallbackSubject<Output extends CovalentData> = {
  next: (value: Output) => void;
  closed: boolean;
};

export type CallbackManagerHandler<Input extends CovalentData, Output extends CovalentData> = (
  subject: CallbackSubject<Output>,
  input: Input,
) => void | PromiseLike<void>;
