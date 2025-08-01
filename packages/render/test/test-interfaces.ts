import { EMPTY, interval, map } from "rxjs";
import { Bridge } from "@covalent/common";
import { BridgeOf, BridgeOpen, Bridges, Proxy } from "../src";

type ClickEvent = { buttons: number; x: number; y: number; ctrl: boolean };


interface LogBridge {
  info: Bridge.Send<string>;
}

interface ExampleBridge {
  doAction: Bridge.Send<string>;
  getConfig: Bridge.Invoke<void, { url: string }>;
  calculate: Bridge.Invoke<{ x: number }, number>;
  onDate: Bridge.On<Date>;
  onClick: Bridge.On<ClickEvent>;
  watchMetrics: Bridge.Callback<{ period: number }, { percentCpuUsage: number }>;
}


@Proxy<LogProxy, LogBridge>({
  group: 'log',
  mirror: ['info'],
})
export class LogProxy {
  public readonly info: LogBridge['info']
    = Bridges.Default.Send();
}


@Proxy<ExampleProxy, ExampleBridge>({
  group: 'example',
  mirror: ['doAction', 'calculate'],
  map: (bridge) => ({
    getConfiguration: bridge.getConfig, // ou Bridges.cache(bridge.getConfig) pour optimiser
    date$: Bridges.of(bridge.onDate),
    click$: Bridges.of(bridge.onClick),
    watch: Bridges.open(bridge, 'watchMetrics'),
  }),
})
export class ExampleProxy {
  public readonly doAction: ExampleBridge['doAction']
    = Bridges.Default.Send();
  public readonly getConfiguration: ExampleBridge['getConfig']
    = Bridges.Default.Invoke({ url: "/" });
  public readonly calculate: ExampleBridge['calculate']
    = Bridges.Default.Invoke(NaN);
  public readonly date$: BridgeOf<ExampleBridge['onDate']>
    = interval(250).pipe(map(() => new Date()));
  public readonly click$: BridgeOf<ExampleBridge['onClick']>
    = EMPTY;
  public readonly watch: BridgeOpen<ExampleBridge['watchMetrics']>
    = Bridges.Default.Callback({ percentCpuUsage: NaN });

  // Si Bridges.cache est utilisé pour getConfiguration.
  public resetConfig(): void {
    Bridges.invalidateCache(this.getConfiguration);
  }
}
