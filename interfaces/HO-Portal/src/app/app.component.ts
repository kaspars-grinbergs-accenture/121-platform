import { Component, EnvironmentInjector } from '@angular/core';
import { environment } from 'src/environments/environment';
import { LoggingService } from './services/logging.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent {
  constructor(
    private loggingService: LoggingService,
    public environmentInjector: EnvironmentInjector,
  ) {
    if (this.loggingService.appInsightsEnabled) {
      this.loggingService.logPageView();
    }

    if (environment.envName) {
      document.title += ` [ ${environment.envName} ]`;
    }
  }
}
