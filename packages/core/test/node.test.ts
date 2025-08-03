import { CallbackManager, CallbackPort, CallbackSubject, Controller, Controllers, OnInit, WebContents } from "../src";
import { ClickEvent, ExampleController, LogController } from "./test-interfaces";

const wc = {
  isDestroyed: jest.fn(() => false),
  isCrashed: jest.fn(() => false),
  send: jest.fn().mockName("webContent.send"),
};

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
    getAllWebContents: jest.fn(() => [wc]),
  },
}));

afterEach(() => {
  Controllers.dispose();
  jest.clearAllMocks();
});

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

  test("should throw an error if cycle dependency detected", async () => {
    class Controller2 {}

    @Controller<Controller1, {}>({
      group: "1",
      bridge: {},
      handlers: () => ({}),
      triggers: () => ({}),
    })
    class Controller1 {
      constructor(private readonly dep: Controller2) {}
    }

    @Controller<Controller2Impl, {}>({
      group: "2",
      bridge: {},
      handlers: () => ({}),
      triggers: () => ({}),
    })
    class Controller2Impl extends Controller2 {
      constructor(private readonly dep: Controller1) {
        super();
      }
    }

    await expect(
      Controllers.register(Controller1, {
        provide: Controller2,
        useClass: Controller2Impl,
      }),
    ).rejects.toThrow();
  });

  test("should throw an error if self dependency detected", async () => {
    @Controller<Controller1, {}>({
      group: "1",
      bridge: {},
      handlers: () => ({}),
      triggers: () => ({}),
    })
    class Controller1 {
      constructor(private readonly dep: Controller1) {}
    }

    await expect(Controllers.register(Controller1)).rejects.toThrow();
  });

  test("should wait initialization", async () => {
    let init = false;

    @Controller<Controller1, {}>({
      group: "1",
      bridge: {},
      handlers: () => ({}),
      triggers: () => ({}),
    })
    class Controller1 implements OnInit {
      async onCovalentInit() {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            init = true;
            resolve();
          }, 2000);
        });
      }
    }

    Controllers.register(Controller1).then();
    expect(init).toBeFalsy();
    await Controllers.waitInit(Controller1);
    expect(init).toBeTruthy();
  });

  test("should make callback emit values", () => {
    const port: CallbackPort<number, number> = {
      id: 0,
      input: 200,
      postMessage: jest.fn(),
      close: jest.fn(),
      onClose: jest.fn(),
    };

    const postSpy = jest.spyOn(port, "postMessage");

    const manager = new CallbackManager<number, number>("test", (subject) => {
      subject.next(400);
    });
    expect(postSpy).not.toHaveBeenCalled();
    manager.watch(port);
    expect(postSpy).toHaveBeenCalled();
    manager.unwatch(0);
  });

  test("should close on watch all", () => {
    const port: CallbackPort<number, number> = {
      id: 0,
      input: 200,
      postMessage: jest.fn(),
      close: jest.fn(),
      onClose: jest.fn(),
    };

    const closeSpy = jest.spyOn(port, "close");

    const manager = new CallbackManager<number, number>("test", (subject) => {
      subject.next(400);
    });
    manager.watch(port);
    expect(closeSpy).not.toHaveBeenCalled();
    manager.unwatch(0);
    expect(closeSpy).toHaveBeenCalled();
  });

  test("should close on unwatch all", () => {
    const port: CallbackPort<number, number> = {
      id: 0,
      input: 200,
      postMessage: jest.fn(),
      close: jest.fn(),
      onClose: jest.fn(),
    };

    const closeSpy = jest.spyOn(port, "close");

    const manager = new CallbackManager<number, number>("test", (subject) => {
      subject.next(400);
    });
    manager.watch(port);
    expect(closeSpy).not.toHaveBeenCalled();
    manager.unwatchAll();
    expect(closeSpy).toHaveBeenCalled();
  });

  test("should detect callback closing from render", () => {
    const closeListeners: (() => void)[] = [];
    const port: CallbackPort<number, number> = {
      id: 0,
      input: 1,
      postMessage: jest.fn().mockName("port:post"),
      close: jest.fn(),
      onClose: jest.fn((listener) => closeListeners.push(listener)),
    };

    let closed = false;
    function watchLoop(subject: CallbackSubject<number>, input: number) {
      if (subject.closed) {
        closed = true;
        return;
      }
      subject.next(input);
      setTimeout(() => watchLoop(subject, 2*input), 100);
    }


    const postSpy = jest.spyOn(port, "postMessage");

    const manager = new CallbackManager<number, number>("test", watchLoop);
    manager.watch(port);

    expect(postSpy).toHaveBeenCalledTimes(1);
    setTimeout(() => {
      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(closed).toBeFalsy();
      closeListeners.forEach(listener => listener());
      setTimeout(() => {
        expect(postSpy).toHaveBeenCalledTimes(2);
        expect(closed).toBeTruthy();
      }, 100);
    }, 150);
  });

  test("should accept multiple registration", async () => {
    await Controllers.register(LogController);
    await Controllers.register(ExampleController);

    await expect(Controllers.get(LogController)).resolves.toBeDefined();
    await expect(Controllers.get(ExampleController)).resolves.toBeDefined();
  })

  test("should broadcast message on channel", () => {
    const sendSpy = jest.spyOn(wc, "send");

    expect(sendSpy).not.toHaveBeenCalled();
    WebContents.send("test", 14, 42);
    expect(sendSpy).toHaveBeenCalledWith("test", 14, 42);
  });

  test("should broadcast message on next", async () => {
    await Controllers.register(ExampleController, LogController);
    const exampleController = await Controllers.get(ExampleController);

    const sendSpy = jest.spyOn(wc, "send");

    expect(sendSpy).not.toHaveBeenCalled();
    const event: ClickEvent = { buttons: 1, x: 0, y: 0, ctrl: false };
    exampleController.clickSubject.next(event)
    expect(sendSpy).toHaveBeenCalledWith("example:onClick", event);
  });
});
