import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config';
import { Database, DB, openDatabase } from './database';

const DATABASE = Symbol('DATABASE');

@Global()
@Module({
  providers: [
    { provide: DATABASE, inject: [CONFIG], useFactory: (config: AppConfig) => openDatabase(config) },
    { provide: DB, inject: [DATABASE], useFactory: (database: Database) => database.db },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async onApplicationShutdown() {
    await this.database.close();
  }
}
