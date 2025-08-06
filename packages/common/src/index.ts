import { IpcRendererEvent } from "electron";

export type CovalentData =
  | null
  | undefined
  | boolean
  | number
  | string
  | Buffer
  | Date
  | Array<CovalentData>
  | { [key: string]: CovalentData }
  | Map<CovalentData, CovalentData>
  | Set<CovalentData>
  | Uint8Array
  | Float32Array
  | Int32Array
  | ArrayBuffer
  | void;

/**
 * Namespace for common types of the Covalent library.
 */
export namespace Bridge {
  /**
   * Object representing data sent by the main process and received by the render processes.
   */
  export type Event<TypeEvent, TypeData> = {
    event?: TypeEvent;
    value: TypeData;
  };

  /**
   * Type for bridge endpoints which would be used by the front to send data to electron.
   */
  export type Send<Input extends CovalentData> = (data: Input) => void;
  /**
   * Type for bridge endpoints which would be used by the front to receive data from electron.
   */
  export type Invoke<Input extends CovalentData, Output extends CovalentData> = (data: Input) => Promise<Output>;

  /**
   * Type for bridge endpoints which would be used by the front to listen to electron.
   */
  export type On<Output extends CovalentData> = (listener: (event: Event<IpcRendererEvent, Output>) => void) => void;
  /**
   * Type for bridge endpoints which would be used by the front to send data to electron and then listen to it.
   */
  export type Callback<Input extends CovalentData, Output extends CovalentData> = (
    listener: (event: Event<MessageEvent, Output>) => void,
    input: Input,
  ) => number;
}
