import { Bridge } from "@electron-covalent/common";
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

  test("should have default behavior", async () => {
    interface TestBridge {
      testSend: Bridge.Send<string>;
      testInvoke: Bridge.Invoke<string, string>;
      testCallback: Bridge.Callback<string, string>;
    }

    const defaultBridge: TestBridge = {
      testSend: jest.fn(),
      testInvoke: jest.fn(),
      testCallback: jest.fn(),
    };
    const sendSpy = jest.spyOn(defaultBridge, "testSend");
    const invokeSpy = jest.spyOn(defaultBridge, "testInvoke");
    const callbackSpy = jest.spyOn(defaultBridge, "testCallback");

    const bridge = Bridges.bind<TestBridge>("test", defaultBridge);

    expect(sendSpy).not.toHaveBeenCalled();
    bridge.testSend("test");
    expect(sendSpy).toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
    bridge.testInvoke("test");
    expect(invokeSpy).toHaveBeenCalled();
    expect(callbackSpy).not.toHaveBeenCalled();
    bridge.testCallback(() => {}, "test");
    expect(callbackSpy).toHaveBeenCalled();
  });
});
