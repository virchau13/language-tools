
export interface File {
  fileName: string;
  source: string;
}

export type RunnerFileMap = Map<string, File>;