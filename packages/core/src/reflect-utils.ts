export abstract class ReflectUtils {
  public static computeMetadataIfAbsent<T>(key: string, target: object, supplier: () => T): T {
    if (Reflect.hasMetadata(key, target)) {
      return Reflect.getMetadata(key, target) as T;
    }
    const value = supplier();
    Reflect.defineMetadata(key, value, target);
    return value;
  }

  private constructor() {}
}
