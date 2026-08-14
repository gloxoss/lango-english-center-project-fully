declare module 'clamdjs' {
  export type Scanner = {
    scanBuffer: (buffer: Buffer, timeout?: number, chunkSize?: number) => Promise<string>;
    scanStream: (stream: NodeJS.ReadableStream, timeout?: number) => Promise<string>;
  };

  export function createScanner(host: string, port: number): Scanner;
  export function isCleanReply(reply: string): boolean;
  export function ping(host: string, port: number, timeout?: number): Promise<boolean>;
  export function version(host: string, port: number, timeout?: number): Promise<string>;
}
