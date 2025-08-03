import "reflect-metadata";
import { ReflectUtils } from "../src/reflect-utils";

describe("utility classes", () => {
  test("should get metadata value", () => {
    class Test {}
    Reflect.defineMetadata("test", "OK", Test);

    expect(ReflectUtils.computeMetadataIfAbsent("test", Test, () => "KO")).toBe("OK");
  });

  test("should get default value if metadata is not found", () => {
    class Test {}

    expect(ReflectUtils.computeMetadataIfAbsent("test", Test, () => "KO")).toBe("KO");
  });
});
