import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import instanceAnonymous from '../../seed-data/instance/instance-anonymous.json';
import programValidation from '../../seed-data/program/program-validation.json';
import { InterfaceScript } from './scripts.module';
import { SeedHelper } from './seed-helper';
import { SeedInit } from './seed-init';

@Injectable()
export class SeedProgramValidation implements InterfaceScript {
  public constructor(private dataSource: DataSource) {}

  private readonly seedHelper = new SeedHelper(this.dataSource);

  public async run(): Promise<void> {
    const seedInit = await new SeedInit(this.dataSource);
    await seedInit.run();

    // ***** CREATE PROGRAM *****
    const program = await this.seedHelper.addProgram(programValidation);

    this.seedHelper.addDefaultUsers(program, true);

    // ***** CREATE INSTANCE *****
    await this.seedHelper.addInstance(instanceAnonymous);
  }
}

export default SeedProgramValidation;
