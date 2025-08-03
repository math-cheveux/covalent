import { Controllers } from "../src";
import { ExampleController, LogController } from "./test-interfaces";

jest.mock("electron", () => ({
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  webContents: {
    getAllWebContents: jest.fn(() => []),
  },
}));

beforeEach(() => Controllers.dispose());

describe("electron-side", () => {
  test("should register controllers", async () => {
    await Controllers.register(ExampleController, LogController);

    await expect(Controllers.get(LogController)).resolves.toBeDefined();
    await expect(Controllers.get(ExampleController)).resolves.toBeDefined();
  });

  test("should link controllers", async () => {
    await Controllers.register(ExampleController, LogController);
    const exampleController = await Controllers.get(ExampleController);
    const logController = await Controllers.get(LogController);

    const infoSpy = jest.spyOn(logController, "info");

    expect(infoSpy).not.toHaveBeenCalled();
    exampleController.doAction("tests");
    expect(infoSpy).toHaveBeenCalled();
  });

  test("should throw an error if dependencies are not provided", async () => {
    await expect(Controllers.get(LogController)).rejects.toThrow();
    await expect(Controllers.register(ExampleController)).rejects.toThrow();
  });
});
