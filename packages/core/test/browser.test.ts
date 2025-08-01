import { Controllers } from "../src";
import { ExampleController, LogController } from "./test-interfaces";
import * as electron from "electron";

jest.mock('electron', () => ({
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
}));

describe("preload script", () => {
  test('should expose controllers', () => {
    const exposeSpy = jest.spyOn(electron.contextBridge, "exposeInMainWorld");

    expect(exposeSpy).not.toHaveBeenCalled();

    Controllers.exposeBridge(ExampleController, LogController);

    expect(exposeSpy).toHaveBeenCalledWith("covalent:bridge", {
      log: {
        info: expect.any(Function),
      },
      example: {
        doAction: expect.any(Function),
        getConfig: expect.any(Function),
        calculate: expect.any(Function),
        onDate: expect.any(Function),
        onClick: expect.any(Function),
        watchMetrics: expect.any(Function),
        "watchMetrics:__close": expect.any(Function),
      },
    });
  });
})
