/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowJs: true,
        strict: true,
        target: 'es2020',
        moduleResolution: 'node',
        jsx: 'react-jsx',
      },
    }],
  },
  // Mock native modules that don't exist in Node
  moduleNameMapper: {
    '^expo-location$': '<rootDir>/src/__tests__/__mocks__/expo-location.ts',
    '^expo-task-manager$': '<rootDir>/src/__tests__/__mocks__/expo-task-manager.ts',
    '^@react-native-community/netinfo$': '<rootDir>/src/__tests__/__mocks__/netinfo.ts',
    '^eventemitter3$': '<rootDir>/src/__tests__/__mocks__/eventemitter3.ts',
    '^expo-sqlite$': '<rootDir>/src/__tests__/__mocks__/expo-sqlite.ts',
  },
};
