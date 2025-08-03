import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  transform: {
    "^.+.tsx?$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.jest.json",
      },
    ],
  },
  testEnvironment: "jsdom",
  setupFiles: ["reflect-metadata"], // charge reflect-metadata avant les tests
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};

export default config;
