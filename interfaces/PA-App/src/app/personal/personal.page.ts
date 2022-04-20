import {
  Component,
  ComponentFactoryResolver,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import {
  AlertController,
  IonContent,
  MenuController,
  ToastButton,
  ToastController,
} from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';
import { AutoSignupComponent } from '../personal-components/auto-signup/auto-signup.component';
import { ConsentQuestionComponent } from '../personal-components/consent-question/consent-question.component';
import { ContactDetailsComponent } from '../personal-components/contact-details/contact-details.component';
import { CreateAccountComponent } from '../personal-components/create-account/create-account.component';
import { EnrollInProgramComponent } from '../personal-components/enroll-in-program/enroll-in-program.component';
import { LoginAccountComponent } from '../personal-components/login-account/login-account.component';
import { MonitoringQuestionComponent } from '../personal-components/monitoring-question/monitoring-question.component';
import { NextPaComponent } from '../personal-components/next-pa/next-pa.component';
import { PersonalDirective } from '../personal-components/personal-component.class';
import {
  PersonalComponents,
  PersonalComponentsRemoved,
} from '../personal-components/personal-components.enum';
import { PreprintedQrcodeComponent } from '../personal-components/preprinted-qrcode/preprinted-qrcode.component';
import { RegistrationSummaryComponent } from '../personal-components/registration-summary/registration-summary.component';
import { SelectFspComponent } from '../personal-components/select-fsp/select-fsp.component';
import { SelectLanguageComponent } from '../personal-components/select-language/select-language.component';
import { SelectProgramComponent } from '../personal-components/select-program/select-program.component';
import { SetNotificationNumberComponent } from '../personal-components/set-notification-number/set-notification-number.component';
import { SignupSigninComponent } from '../personal-components/signup-signin/signup-signin.component';
import {
  ConversationSection,
  ConversationService,
} from '../services/conversation.service';
import { PaDataService } from '../services/padata.service';
import { RegistrationModeService } from '../services/registration-mode.service';
import { SyncService } from '../services/sync.service';
import { InclusionStatusComponent } from './../personal-components/inclusion-status/inclusion-status.component';

@Component({
  selector: 'app-personal',
  templateUrl: 'personal.page.html',
  styleUrls: ['personal.page.scss'],
})
export class PersonalPage implements OnInit, OnDestroy {
  @ViewChild(IonContent)
  public ionContent: IonContent;

  @ViewChild('conversationContainer', { read: ViewContainerRef, static: true })
  public container: ViewContainerRef;

  public isDebug: boolean = environment.isDebug;
  public showDebug: boolean = environment.isDebug
    ? this.debugCheckShowDebug()
    : false;

  private scrollSpeed = environment.useAnimation ? 600 : 0;

  public isOnline = navigator.onLine;

  public batchCount: number;

  private batchProgressAlert: HTMLIonAlertElement;

  private availableSections = {
    [PersonalComponents.consentQuestion]: ConsentQuestionComponent,
    [PersonalComponents.contactDetails]: ContactDetailsComponent,
    [PersonalComponents.createAccount]: CreateAccountComponent,
    [PersonalComponents.enrollInProgram]: EnrollInProgramComponent,
    [PersonalComponents.inclusionStatus]: InclusionStatusComponent,
    [PersonalComponents.loginAccount]: LoginAccountComponent,
    [PersonalComponents.monitoringQuestion]: MonitoringQuestionComponent,
    [PersonalComponents.registrationSummary]: RegistrationSummaryComponent,
    [PersonalComponents.preprintedQrcode]: PreprintedQrcodeComponent,
    [PersonalComponents.selectFsp]: SelectFspComponent,
    [PersonalComponents.selectLanguage]: SelectLanguageComponent,
    [PersonalComponents.selectProgram]: SelectProgramComponent,
    [PersonalComponents.setNotificationNumber]: SetNotificationNumberComponent,
    [PersonalComponents.signupSignin]: SignupSigninComponent,
    [PersonalComponents.autoSignup]: AutoSignupComponent,
    [PersonalComponents.nextPa]: NextPaComponent,
  };
  public debugSections = Object.keys(this.availableSections);

  constructor(
    public conversationService: ConversationService,
    private resolver: ComponentFactoryResolver,
    public translate: TranslateService,
    private paDataService: PaDataService,
    private menu: MenuController,
    public alertController: AlertController,
    public registrationMode: RegistrationModeService,
    public syncService: SyncService,
    public toastController: ToastController,
    public swUpdates: SwUpdate,
  ) {
    // Listen for completed sections, to continue with next steps

    this.conversationService.updateConversation$.subscribe(
      async (nextAction: string) => {
        if (this.reloadNeeded(nextAction)) {
          await this.loadComponents();
          this.scrollToLastWhenReady();
          return;
        }

        this.insertSection(nextAction);
      },
    );
    // Listen for scroll events
    this.conversationService.shouldScroll$.subscribe((toY: number) => {
      if (toY === -1) {
        return this.scrollDown();
      }

      if (toY === -2) {
        return this.scrollToLastWhenReady();
      }

      this.ionContent.scrollToPoint(0, toY, this.scrollSpeed);
    });

    window.addEventListener('online', () => this.goOnline(), { passive: true });
    window.addEventListener('offline', () => this.goOffline(), {
      passive: true,
    });

    this.syncService.getBatchCount().subscribe((batchCount) => {
      this.batchCount = batchCount;
    });

    this.swUpdates.activated.subscribe((event) => {
      this.notifyOfflineAvailable();
    });

    this.swUpdates.available.subscribe((event) => {
      this.swUpdates.activateUpdate().then(
        () => {
          this.notifyUpdateAvailable();
        },
        (error) => {
          console.error('ServiceWorker activation error:', error);
          this.notifySwError();
        },
      );
    });
  }

  async ngOnInit() {
    // Prevent automatic behaviour while debugging/developing:
    if (this.isDebug && this.showDebug) {
      return;
    }
    this.conversationService.startLoading();
    await this.loadEndpoints();
    await this.loadComponents();
    this.conversationService.stopLoading();
    this.scrollToLastWhenReady();
  }

  ngOnDestroy() {
    window.removeEventListener('online', () => this.goOnline());
    window.removeEventListener('offline', () => this.goOffline());
  }

  private goOnline() {
    this.isOnline = true;
    this.autoBatchUpload();
  }

  private goOffline() {
    this.isOnline = false;
    if (this.batchProgressAlert) {
      this.batchProgressAlert.dismiss();
    }
  }

  private async notifyOfflineAvailable() {
    this.notify(this.translate.instant('notification.offline-available'), [
      {
        side: 'end',
        icon: 'close',
        role: 'cancel',
      },
    ]);
  }

  private async notifyUpdateAvailable() {
    this.notify(this.translate.instant('notification.update-available'), [
      {
        side: 'end',
        icon: 'refresh',
        handler: () => {
          document.location.reload();
        },
      },
    ]);
  }

  private async notifySwError() {
    this.notify(this.translate.instant('notification.error-reload'), [
      {
        side: 'end',
        icon: 'refresh',
        handler: () => {
          document.location.reload();
        },
      },
    ]);
  }

  private async notify(message: string, buttons: ToastButton[] = []) {
    const toast = await this.toastController.create({
      message,
      cssClass: 'system-notification ion-text-center',
      position: 'top',
      color: 'tertiary',
      buttons,
    });
    await toast.present();
  }

  private async autoBatchUpload() {
    if (this.batchCount === 0) {
      return;
    }

    this.batchProgressAlert = await this.alertController.create({
      header: this.translate.instant('personal.batch.upload-alert-header'),
      message: this.translate.instant('personal.batch.upload-alert-message', {
        nrRegistrations: this.batchCount,
      }),
    });

    this.syncService.getBatchCount().subscribe((count) => {
      this.batchProgressAlert.message = this.translate.instant(
        'personal.batch.upload-alert-message',
        {
          nrRegistrations: count,
        },
      );

      if (count === 0) {
        this.batchProgressAlert.dismiss();
      }
    });

    await this.batchProgressAlert.present();
  }

  private filterOutRemovedSections(
    conversation: ConversationSection[],
  ): ConversationSection[] {
    return conversation.filter((section) => {
      return (
        this.availableSections.hasOwnProperty(section.name) &&
        !PersonalComponentsRemoved.includes(section.name)
      );
    });
  }

  private async loadEndpoints() {
    await this.paDataService.getInstance();
    const programs = await this.paDataService.getAllPrograms();
    for (const program of programs) {
      const detailedProgram = await this.paDataService.getProgram(program.id);
      for (const fsp of detailedProgram.financialServiceProviders) {
        await this.paDataService.getFspById(fsp.id);
      }
    }
  }

  private async loadComponents() {
    // Always start with a clean slate:
    this.container.clear();

    let conversation = await this.conversationService.getConversationUpToNow();
    conversation = this.filterOutRemovedSections(conversation);

    conversation.forEach((section: ConversationSection) => {
      this.insertSection(
        section.name,
        { animate: false },
        section.moment,
        section.data,
      );
    });
  }

  private getComponentFactory(name: string) {
    return this.resolver.resolveComponentFactory(this.availableSections[name]);
  }

  public insertSection(
    name: string,
    options: { animate: boolean } = { animate: environment.useAnimation },
    moment?: number,
    data?: any,
  ) {
    if (!name) {
      return;
    }

    const componentRef = this.container.createComponent(
      this.getComponentFactory(name),
    );
    const componentInstance: any | PersonalDirective = componentRef.instance;

    componentInstance.moment = moment;
    componentInstance.data = data;
    componentInstance.animate = options.animate;
    componentInstance.isOnline = this.isOnline;
  }

  public scrollDown() {
    this.ionContent.scrollToBottom(this.scrollSpeed);
  }

  public scrollToLastSection() {
    const lastSection: any = this.container.get(this.container.length - 1);

    if (!lastSection || !lastSection.rootNodes || !lastSection.rootNodes[0]) {
      return;
    }
    lastSection.rootNodes[0].scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  }

  private async scrollToLastWhenReady() {
    window.setTimeout(() => {
      this.scrollToLastSection();
    }, 600);
  }

  public debugClearAllStorage() {
    window.sessionStorage.clear();
  }

  public async debugStartFromHistory() {
    await this.loadComponents();
    this.scrollToLastWhenReady();
  }

  private debugCheckShowDebug(): boolean {
    return (
      environment.showDebug || !!window.sessionStorage.getItem('showDebug')
    );
  }
  public debugToggleShowDebug() {
    this.showDebug = !this.showDebug;
    window.sessionStorage.setItem('showDebug', this.showDebug ? '1' : '');
  }

  public onBatchButtonClick() {
    if (!this.registrationMode.multiple) {
      return;
    }
    this.menu.enable(true, 'batchMenu');
    this.menu.open('batchMenu');
  }

  public uploadBatchRegistrations() {
    this.autoBatchUpload();
  }

  private reloadNeeded(action) {
    return [
      this.conversationService.conversationActions.afterLogin,
      this.conversationService.conversationActions.afterBatchSubmit,
      this.conversationService.conversationActions.afterDisagree,
      this.conversationService.conversationActions.afterLogout,
    ].includes(action);
  }
}
