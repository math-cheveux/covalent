import { Bridges } from "../src";
import { ExampleProxy, LogProxy } from "./test-interfaces";

describe("browser-side without electron", () => {
  // @ts-ignore
  window[Bridges.EXPOSE_KEY] = undefined;

  const logProxy = new LogProxy();
  const exampleProxy = new ExampleProxy();

  test("should not be bound", () => {
    expect(Bridges.isBound("log")).toBeFalsy();
    expect(Bridges.isBound("example")).toBeFalsy();
  });

  test("should not bind", () => {
    expect(Bridges.bind("log")).toStrictEqual({});
    expect(Bridges.bind("example")).toStrictEqual({});
  });

  test("should not throw errors", async () => {
    expect(() => logProxy.info("test")).not.toThrow();
    expect(() => exampleProxy.doAction("test")).not.toThrow();
    await expect(exampleProxy.getConfiguration()).resolves.not.toThrow();
    await expect(exampleProxy.calculate({ x: 0 })).resolves.not.toThrow();
    await expect(exampleProxy.watch({ period: 100 })).resolves.not.toThrow();
  });
});
