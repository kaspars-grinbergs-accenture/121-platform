import { UserEntity } from '../user/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Column,
  OneToMany,
  AfterUpdate,
  AfterInsert,
  Repository,
  UpdateEvent,
  getConnection,
  BeforeInsert,
} from 'typeorm';
import { ProgramEntity } from '../programs/program/program.entity';
import { RegistrationStatusEnum } from './enum/registration-status.enum';
import { ProgramAnswerEntity } from './program-answer.entity';
import { RegistrationStatusChangeEntity } from './registration-status-change.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FinancialServiceProviderEntity } from '../programs/fsp/financial-service-provider.entity';
import { LanguageEnum } from './enum/language.enum';
import { IsInt, IsPositive, IsOptional } from 'class-validator';

@Entity('registration')
export class RegistrationEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(
    type => ProgramEntity,
    program => program.registrations,
  )
  public program: ProgramEntity;

  @ManyToOne(() => UserEntity)
  public user: UserEntity;

  @OneToMany(
    () => RegistrationStatusChangeEntity,
    statusChange => statusChange.registration,
  )
  public statusChanges: RegistrationStatusChangeEntity[];

  @Index()
  @Column({ nullable: true })
  public registrationStatus: RegistrationStatusEnum;

  @Column({ nullable: true })
  public qrIdentifier: string;

  @Index({ unique: true })
  @Column()
  public referenceId: string;

  @OneToMany(
    () => ProgramAnswerEntity,
    programAnswer => programAnswer.registration,
  )
  public programAnswers: ProgramAnswerEntity[];

  @Column('json', {
    default: {},
  })
  public customData: JSON;

  @Column({ nullable: true })
  public phoneNumber: string;

  @Column({ nullable: true })
  public preferredLanguage: LanguageEnum;

  @Column({ nullable: true })
  public inclusionScore: number;

  @ManyToOne(type => FinancialServiceProviderEntity)
  public fsp: FinancialServiceProviderEntity;

  @Column({ nullable: true })
  public namePartnerOrganization: string;

  @Column({ nullable: true })
  @IsInt()
  @IsPositive()
  @IsOptional()
  public paymentAmountMultiplier: number;
}
