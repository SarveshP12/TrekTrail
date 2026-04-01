// Mock for expo-sqlite — used by gps-repository in test environment
export async function openDatabaseAsync(name: string) {
  return {
    runAsync: async () => {},
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
    execAsync: async () => {},
  };
}

export type SQLiteDatabase = {
  runAsync: (...args: any[]) => Promise<void>;
  getFirstAsync: <T>(...args: any[]) => Promise<T | null>;
  getAllAsync: <T>(...args: any[]) => Promise<T[]>;
  execAsync: (...args: any[]) => Promise<void>;
};
