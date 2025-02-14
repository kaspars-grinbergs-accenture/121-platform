import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { DateFormat } from 'src/app/enums/date-format.enum';
import { environment } from '../../../environments/environment';
import { Message, MessageStatusMapping } from '../../models/message.model';
import { Person } from '../../models/person.model';
import { ProgramsServiceApiService } from '../../services/programs-service-api.service';

@Component({
  selector: 'app-message-history-popup',
  templateUrl: './message-history-popup.component.html',
  styleUrls: ['./message-history-popup.component.scss'],
})
export class MessageHistoryPopupComponent implements OnInit {
  @Input()
  public person: Person;

  @Input()
  public programId: number;

  public DateFormat = DateFormat;
  public messageHistory: Message[];
  public historySize = 5;
  public trimBodyLength = 20;
  public imageString = '(image)';
  public rowIndex: number;
  public chipStatus = MessageStatusMapping;
  public errorCodeUrl = `${environment.twilio_error_codes_url}/`;

  constructor(
    private programsService: ProgramsServiceApiService,
    private modalController: ModalController,
  ) {}

  ngOnInit() {
    this.getMessageHistory();
  }

  private async getMessageHistory() {
    this.messageHistory = await this.programsService.retrieveMsgHistory(
      this.programId,
      this.person?.referenceId,
    );
  }
  public async loadMore(historyLength) {
    this.historySize = historyLength;
  }
  public openMessageDetails(index) {
    if (index === this.rowIndex) {
      this.rowIndex = null;
    } else {
      this.rowIndex = index;
    }
  }

  public closeModal() {
    this.modalController.dismiss();
  }
}
