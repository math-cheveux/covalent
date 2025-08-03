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
  testEnvironment: "node",
  setupFiles: ["reflect-metadata"], // charge reflect-metadata avant les tests
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.{ts,tsx}"],
  coverageReporters: ["text", "html", "lcov"],
  coverageDirectory: "coverage",
};

export default config;
