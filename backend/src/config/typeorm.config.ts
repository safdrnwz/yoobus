import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
export const typeOrmConfig = (c: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: c.get('database.host'),
  port: c.get('database.port'),
  username: c.get('database.username'),
  password: c.get('database.password'),
  database: c.get('database.name'),
  autoLoadEntities: true,
  synchronize: c.get('database.synchronize'),
  logging: c.get('database.logging'),
});
