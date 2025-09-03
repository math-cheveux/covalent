import { Bridges } from "../src";
import { ExampleBridge, ExampleProxy, LogProxy } from "./test-interfaces";

afterEach(() => {
  Bridges.invalidateCaches();
  jest.clearAllMocks();
});

function spyBridge(group: string, endPoint: string): jest.SpyInstance {
  // @ts-ignore
  return jest.spyOn(window[Bridges.EXPOSE_KEY][group], endPoint);
}

describe("browser-side inside electron", () => {
  // @ts-ignore
  window[Bridges.EXPOSE_KEY] = {
    log: {
      info: jest.fn().mockName("log:info"),
    },
    example: {
      doAction: jest.fn().mockName("example:doAction"),
      getConfig: jest.fn().mockName("example:getConfig"),
      calculate: jest.fn().mockName("example:calculate"),
      getDate: jest.fn(() => Promise.resolve(new Date())).mockName("example:getDate"),
      onDate: jest.fn().mockName("example:onDate"),
      onClick: jest.fn().mockName("example:onClick"),
      getMetrics: jest.fn(() => Promise.resolve(0.14)).mockName("example:getMetrics"),
      watchMetrics: jest.fn().mockName("example:watchMetrics"),
      "watchMetrics:__close": jest.fn().mockName("example:watchMetrics:close"),
    },
  };

  const logProxy = new LogProxy();
  const exampleProxy = new ExampleProxy();

  test("should be bound", () => {
    expect(Bridges.isBound("log")).toBeTruthy();
    expect(Bridges.isBound("example")).toBeTruthy();
  });

  test("should bind", () => {
    // @ts-ignore
    expect(Bridges.bind("log")).toMatchObject(window[Bridges.EXPOSE_KEY]["log"]);
    // @ts-ignore
    expect(Bridges.bind("example")).toMatchObject(window[Bridges.EXPOSE_KEY]["example"]);
  });

  test("should call bridge", () => {
    const infoSpy = spyBridge("log", "info");

    expect(infoSpy).not.toHaveBeenCalled();
    logProxy.info("test");
    expect(infoSpy).toHaveBeenCalledWith("test");
  });

  test("should use cache", async () => {
    const configSpy = spyBridge("example", "getConfig");

    expect(configSpy).toHaveBeenCalledTimes(0);
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(1);
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(1);
  });

  test("should reset cache", async () => {
    const configSpy = spyBridge("example", "getConfig");

    expect(configSpy).toHaveBeenCalledTimes(0);
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(1);
    exampleProxy.resetConfig();
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(2);
  });

  test("should reset all cache", async () => {
    const configSpy = spyBridge("example", "getConfig");

    expect(configSpy).toHaveBeenCalledTimes(0);
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(1);
    Bridges.invalidateCaches();
    await exampleProxy.getConfiguration();
    expect(configSpy).toHaveBeenCalledTimes(2);
  });

  test("should reset cache after X times", async () => {
    const configSpy = spyBridge("example", "getConfig");
    // @ts-ignore
    const configMethod = Bridges.cache(Bridges.bind<ExampleBridge>("example")["getConfig"], {
      invalidate: {
        callCount: 2,
      },
    });

    expect(configSpy).toHaveBeenCalledTimes(0);
    await configMethod();
    expect(configSpy).toHaveBeenCalledTimes(1);
    await configMethod();
    expect(configSpy).toHaveBeenCalledTimes(1);
    await configMethod();
    expect(configSpy).toHaveBeenCalledTimes(2);
  });

  test("should reset cache after period", async () => {
    const configSpy = spyBridge("example", "getConfig");
    // @ts-ignore
    const configMethod = Bridges.cache(Bridges.bind<ExampleBridge>("example")["getConfig"], {
      invalidate: {
        duration: 2500,
      },
    });

    expect(configSpy).toHaveBeenCalledTimes(0);
    await configMethod();
    expect(configSpy).toHaveBeenCalledTimes(1);
    await configMethod();
    expect(configSpy).toHaveBeenCalledTimes(1);
    setTimeout(async () => {
      await configMethod();
      expect(configSpy).toHaveBeenCalledTimes(2);
    }, 5000);
  });

  test("should open and close callback", () => {
    const watchSpy = spyBridge("example", "watchMetrics");
    const closeSpy = spyBridge("example", "watchMetrics:__close");

    expect(watchSpy).not.toHaveBeenCalled();
    const obs = exampleProxy.watch({ period: 200 });
    setTimeout(() => {
      expect(watchSpy).toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      obs.complete();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  test("should callback have default value", () => {
    const watchMethod = Bridges.open<ExampleBridge, { period: number }, { percentCpuUsage: number }>(
      Bridges.bind<ExampleBridge>("example"),
      "watchMetrics",
    );

    const obs = watchMethod.open({ period: 200 }, { defaultValue: { percentCpuUsage: 0.42 } });
    obs.subscribe((data) => {
      expect(data.percentCpuUsage).toBe(0.42);
      obs.complete();
    });
  });

  test("should on observable get first value from invoke", () => {
    const getSpy = spyBridge("example", "getDate");
    const onSpy = spyBridge("example", "onDate");

    expect(getSpy).not.toHaveBeenCalled();
    expect(onSpy).not.toHaveBeenCalled();
    new ExampleProxy();
    setTimeout(() => {
      expect(getSpy).toHaveBeenCalled();
      expect(onSpy).toHaveBeenCalled();
    }, 200);
  });

  test("should callback get first value from invoke", () => {
    const watchMethod = Bridges.open<ExampleBridge, { period: number }, { percentCpuUsage: number }>(
      Bridges.bind<ExampleBridge>("example"),
      "watchMetrics",
    );

    const obs = watchMethod.open(
      { period: 200 },
      {
        defaultValue: { percentCpuUsage: NaN },
        init: Bridges.bind<ExampleBridge>("example")["getMetrics"](),
      },
    );
    obs.subscribe((data) => {
      expect(data.percentCpuUsage).toBe(0.14);
      obs.complete();
    });
  });
});
