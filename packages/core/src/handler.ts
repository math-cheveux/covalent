import { CovalentData } from "@electron-covalent/common";
import { CallbackPort } from "./callback";

export namespace Handler {
  /**
   * Type for 'send' messages callbacks.
   *
   * @see Bridge.Send
   */
  export type Send<Input extends CovalentData> = (data: Input) => void | PromiseLike<void>;
  /**
   * Type for 'invoke' messages callbacks.
   *
   * @see Bridge.Invoke
   */
  export type Invoke<Input extends CovalentData, Output extends CovalentData> = (
    data: Input,
  ) => Output | PromiseLike<Output>;
  /**
   * Type for 'callback' messages callbacks.
   *
   * @see Bridge.Callback
   */
  export type Callback<Input extends CovalentData, Output extends CovalentData> = (
    replyPort: CallbackPort<Input, Output>,
  ) => void | PromiseLike<void>;
}
