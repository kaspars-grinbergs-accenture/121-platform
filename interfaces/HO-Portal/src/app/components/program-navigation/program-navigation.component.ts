import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'src/app/auth/auth.service';
import Permission from 'src/app/auth/permission.enum';
import { Program } from 'src/app/models/program.model';
import { ProgramsServiceApiService } from 'src/app/services/programs-service-api.service';
import { PhaseNavigationComponent } from '../../program/phase-navigation/phase-navigation.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    RouterModule,
    PhaseNavigationComponent,
  ],
  selector: 'app-program-navigation',
  templateUrl: './program-navigation.component.html',
  styleUrls: ['./program-navigation.component.scss'],
})
export class ProgramNavigationComponent implements OnInit {
  public programId: number;
  private program: Program;

  public showManageAidworkers: boolean;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private programsService: ProgramsServiceApiService,
  ) {
    this.programId = this.route.snapshot.params.id;
  }

  public async ngOnInit() {
    await this.loadProgramDetails();
    this.showManageAidworkers = !!this.program?.validation;
  }

  private async loadProgramDetails() {
    this.program = await this.programsService.getProgramById(this.programId);
  }

  public canManageAidWorkers(): boolean {
    return this.authService.hasAllPermissions(this.programId, [
      Permission.AidWorkerProgramUPDATE,
    ]);
  }
}
