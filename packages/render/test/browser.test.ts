import { ExampleProxy, LogProxy } from "./test-interfaces";

describe("browser-side without electron", () => {
  const logProxy = new LogProxy();
  const exampleProxy = new ExampleProxy();

  test("should have default behavior", () => {});
});

describe("browser-side", () => {
  // @ts-ignore
  window["covalent:bridge"] = {
    log: {
      info: jest.fn().mockName("log:info"),
    },
    example: {
      doAction: jest.fn().mockName("example:doAction"),
      getConfig: jest.fn().mockName("example:getConfig"),
      calculate: jest.fn().mockName("example:calculate"),
      onDate: jest.fn().mockName("example:onDate"),
      onClick: jest.fn().mockName("example:onClick"),
      watchMetrics: jest.fn().mockName("example:watchMetrics"),
      "watchMetrics:__close": jest.fn().mockName("example:watchMetrics:close"),
    },
  };

  const logProxy = new LogProxy();
  const exampleProxy = new ExampleProxy();

  test("should call bridge", () => {
    // @ts-ignore
    const infoSpy = jest.spyOn(window["covalent:bridge"]["log"], "info");

    expect(infoSpy).not.toHaveBeenCalled();
    logProxy.info("test");
    expect(infoSpy).toHaveBeenCalledWith("test");
  });
});
