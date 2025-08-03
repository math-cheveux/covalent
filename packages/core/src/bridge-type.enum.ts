import { Bridge, CovalentData } from "@electron-covalent/common";
import { Handler } from "./handler";
import { Main, Renderer } from "./ipc";

/**
 * Enumeration of the possible types a bridge can contain.
 */
export abstract class BridgeType {
  /**
   * @see Bridge.Send
   */
  public static readonly SEND: BridgeType = new (class extends BridgeType {})(
    Renderer.send,
    Main.on,
  );
  /**
   * @see Bridge.Invoke
   */
  public static readonly INVOKE: BridgeType = new (class extends BridgeType {})(
    Renderer.invoke,
    Main.handle,
  );
  /**
   * @see Bridge.On
   */
  public static readonly ON: BridgeType = new (class extends BridgeType {})(
    Renderer.on,
  );
  /**
   * @see Bridge.Callback
   */
  public static readonly CALLBACK: BridgeType = new (class extends BridgeType {})(
    Renderer.callback,
    Main.onMessagePort,
  );

  constructor(
    public readonly bridge:
      | ((channel: string) => Bridge.Send<CovalentData>)
      | ((channel: string) => Bridge.Invoke<CovalentData, CovalentData>)
      | ((channel: string) => Bridge.On<CovalentData>)
      | ((channel: string) => Bridge.Callback<CovalentData, CovalentData>),
    public readonly handler?:
      | ((channel: string, handler: Handler.Send<CovalentData>) => void)
      | ((channel: string, handler: Handler.Invoke<CovalentData, CovalentData>) => void)
      | ((channel: string, handler: Handler.Callback<CovalentData, CovalentData>) => void),
  ) {}
}
