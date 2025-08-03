import { interval, map, Subject } from "rxjs";
import { Bridge } from "@electron-covalent/common";
import { BridgeType, CallbackSubject, Controller, OnInit } from "../src";

export type ClickEvent = { buttons: number; x: number; y: number; ctrl: boolean };

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

@Controller<LogController, LogBridge>({
  group: "log",
  bridge: {
    info: BridgeType.SEND,
  },
  handlers: (self) => ({
    info: self.info,
  }),
  triggers: (_) => ({}),
})
export class LogController implements OnInit {
  onCovalentInit(): void | PromiseLike<void> {}

  public info(msg: string) {
    console.log(msg);
  }
}

@Controller<ExampleController, ExampleBridge>({
  group: "example",
  bridge: {
    doAction: BridgeType.SEND,
    getConfig: BridgeType.INVOKE,
    calculate: BridgeType.INVOKE,
    onDate: BridgeType.ON,
    onClick: BridgeType.ON,
    watchMetrics: BridgeType.CALLBACK,
  },
  handlers: (self) => ({
    doAction: self.doAction,
    getConfig: () => self.config,
    calculate: self.calculate,
    watchMetrics: self.startWatchingMetrics,
  }),
  triggers: (self) => ({
    onDate: interval(200).pipe(map(() => new Date())),
    onClick: self.clickSubject.asObservable(),
  }),
})
export class ExampleController {
  constructor(private readonly logController: LogController) {}

  public clickSubject = new Subject<ClickEvent>();

  public doAction(action: string) {
    this.logController.info(`Doing ${action}.`);
  }

  public get config(): { url: string } {
    return { url: "/test" };
  }

  public calculate(params: { x: number }): number {
    return Math.exp(params.x);
  }

  public startWatchingMetrics(subject: CallbackSubject<{ percentCpuUsage: number }>, input: { period: number }) {
    this.watchMetrics(subject, input.period);
  }

  private watchMetrics(subject: CallbackSubject<{ percentCpuUsage: number }>, period: number) {
    if (subject.closed) {
      return;
    }
    subject.next({ percentCpuUsage: Math.random() });
    setTimeout(() => this.watchMetrics(subject, period), period);
  }
}
