import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import intanceLbn from '../../seed-data/instance/instance-pilot-lbn.json';
import programPilotLbn from '../../seed-data/program/program-pilot-lbn.json';
import { InterfaceScript } from './scripts.module';
import { SeedHelper } from './seed-helper';
import { SeedInit } from './seed-init';

@Injectable()
export class SeedProgramLbn implements InterfaceScript {
  public constructor(private dataSource: DataSource) {}

  private readonly seedHelper = new SeedHelper(this.dataSource);

  public async run(): Promise<void> {
    const seedInit = await new SeedInit(this.dataSource);
    await seedInit.run();

    // ***** CREATE PROGRAM *****
    const program = await this.seedHelper.addProgram(programPilotLbn);

    this.seedHelper.addDefaultUsers(program, true);

    // ***** CREATE INSTANCE *****
    await this.seedHelper.addInstance(intanceLbn);
  }
}

export default SeedProgramLbn;
