import { UserRoleEntity } from './../src/user/user-role.entity';
import { EntityManager, MigrationInterface, QueryRunner } from 'typeorm';

export class programAdmin1666165585423 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.commitTransaction();
    // 08-11-2022 migrateData() is commented out as this was causing issues with new entities and legacy migrations.
    // await this.migrateData(queryRunner.manager);
    // Start artifical transaction because typeorm migrations automatically tries to close a transcation after migration
    await queryRunner.startTransaction();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}

  private async migrateData(manager: EntityManager): Promise<void> {
    const userRoleRepo = manager.getRepository(UserRoleEntity);
    const roles = await userRoleRepo.find({
      where: { role: 'admin' },
    });
    for (const r of roles) {
      r.role = 'program-admin';
      r.label = 'Program Admin';
      await userRoleRepo.save(r);
    }
  }
}
