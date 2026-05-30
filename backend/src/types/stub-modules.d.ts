declare module 'bcrypt' {
  export function hash(data: any, saltOrRounds: any): Promise<string>;
  export function compare(data: any, encrypted: any): Promise<boolean>;
}

declare module 'express-rate-limit' {
  const rateLimit: any;
  export default rateLimit;
}

declare module 'aedes' {
  export class Aedes {
    static createBroker(options?: any): Promise<Aedes>;
    authenticate: any;
    on(event: string, callback: (...args: any[]) => void): this;
    handle(stream: any): void;
  }
  const aedes: () => Aedes;
  export default aedes;
}

declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    query<T = any>(queryText: string, values?: any[]): Promise<{ rows: T[], rowCount: number }>;
    on(event: string, callback: (...args: any[]) => void): this;
    end(): Promise<void>;
  }
}

declare module 'redis' {
  export function createClient(options?: any): any;
  export type RedisClientType = any;
}
