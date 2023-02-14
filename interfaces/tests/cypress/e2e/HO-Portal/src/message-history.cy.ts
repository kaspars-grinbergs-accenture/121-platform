import { MessageStatus } from './../../../../../../interfaces/HO-Portal/src/app/models/message.model';
import portalEn from '../../../../../HO-Portal/src/assets/i18n/en.json';
import { ProgramPhase } from '../../../../../../services/121-service/src/shared/enum/program-phase.model';
import programLVV from '../../../../../../services/121-service/seed-data/program/program-pilot-nl.json';

describe('Check message history', () => {
  beforeEach(() => {
    cy.seedDatabase();
    cy.loginApi();
    cy.loginPortal();
  });

  it('Send 1 whatsapp message', function () {
    const messageText =
      programLVV.notifications.en.whatsappGenericMessage;
    const label =
      portalEn.page.program['program-people-affected'][
        'message-history-popup'
      ]['content-type']['generic-templated'];

    cy.importRegistrations(1);
    cy.moveToSpecifiedPhase(1, ProgramPhase.registrationValidation);
    cy.fixture('message-history').then((fixture) => {
      // Send message
      // Monitor text message request
      cy.intercept({ method: 'POST', url: '**/text-message' }).as(
        'textmessage',
      );

      cy.setHoPortal();
      cy.visit(fixture.url).then(() => {
        cy.sendBulkMessage(fixture.messageText).then(() => {
          // Check PA-table
          checkPATable(fixture, MessageStatus.delivered, 'WHATSAPP');

          cy.fixture('registration-nlrc').then((registration) => {
            // Check Message History Popup
            checkMessageHistoryPopup(
              registration,
              label,
              messageText,
              'whatsapp',
              MessageStatus.delivered,
            );
          });
        });
      });
    });
  });

  it('Send 1 sms message', function () {
    cy.fixture('registration-nlrc-no-whatsapp').then(
      (registrationNoWhatsapp) => {
        cy.importRegistrations(1, [registrationNoWhatsapp]);
        cy.moveToSpecifiedPhase(1, ProgramPhase.registrationValidation);
        cy.fixture('message-history').then((fixture) => {
          // Send message
          // Monitor text message request
          cy.intercept({ method: 'POST', url: '**/text-message' }).as(
            'textmessage',
          );

          cy.setHoPortal();
          cy.visit(fixture.url);
          cy.sendBulkMessage(fixture.messageText);

          // Check PA-table
          checkPATable(fixture, MessageStatus.sent, 'SMS');

          // Check Message History Popup
          const customLabel =
            portalEn.page.program['program-people-affected'][
              'message-history-popup'
            ]['content-type'].custom;
          checkMessageHistoryPopup(
            registrationNoWhatsapp,
            customLabel,
            fixture.messageText,
            'sms',
            MessageStatus.sent,
          );
        });
      },
    );
  });

  it('Send 1 failed sms message', function () {
    cy.fixture('registration-nlrc-no-whatsapp').then(
      (registrationNoWhatsapp) => {
        registrationNoWhatsapp.phoneNumber = '15005550001';
        cy.importRegistrations(1, [registrationNoWhatsapp]);
        cy.moveToSpecifiedPhase(1, ProgramPhase.registrationValidation);
        cy.fixture('message-history').then((fixture) => {
          // Send message
          // Monitor text message request
          cy.intercept({ method: 'POST', url: '**/text-message' }).as(
            'textmessage',
          );

          cy.setHoPortal();
          cy.visit(fixture.url);

          cy.sendBulkMessage(fixture.messageText);

          // Check PA-table
          checkPATable(fixture, MessageStatus.failed, 'SMS');

          // Check Message History Popup
          const customLabel =
            portalEn.page.program['program-people-affected'][
              'message-history-popup'
            ]['content-type'].custom;
          checkMessageHistoryPopup(
            registrationNoWhatsapp,
            customLabel,
            fixture.messageText,
            'sms',
            MessageStatus.failed,
          );
        });
      },
    );
  });

  it('Send 1 succes message than 1 failed sms message', function () {
    const programId = 1;
    cy.fixture('registration-nlrc-no-whatsapp').then(
      (registrationNoWhatsapp) => {
        cy.importRegistrations(1, [registrationNoWhatsapp]);
        cy.moveToSpecifiedPhase(1, ProgramPhase.registrationValidation);
        cy.fixture('message-history').then((fixture) => {
          // Send message
          // Monitor text message request
          cy.intercept({ method: 'POST', url: '**/text-message' }).as(
            'textmessage',
          );

          cy.setHoPortal();
          cy.visit(fixture.url).then(() => {
            cy.sendBulkMessage(fixture.messageText).then(() => {
              cy.getAllPeopleAffected(programId).then((response) => {
                for (const pa of response.body) {
                  cy.editPaAttribute(
                    programId,
                    pa.referenceId,
                    'phoneNumber',
                    '15005550001',
                  );
                }

                cy.setHoPortal();
                const interceptIdMessage2 = 'textmessage2';
                cy.intercept({ method: 'POST', url: '**/text-message' }).as(
                  interceptIdMessage2,
                );
                cy.sendBulkMessage(fixture.messageText).then(() => {
                  // // Check PA-table
                  checkPATable(
                    fixture,
                    MessageStatus.failed,
                    'SMS',
                    interceptIdMessage2,
                  );

                  // Check Message History Popup
                  const customLabel =
                    portalEn.page.program['program-people-affected'][
                      'message-history-popup'
                    ]['content-type'].custom;
                  checkMessageHistoryPopup(
                    registrationNoWhatsapp,
                    customLabel,
                    fixture.messageText,
                    'sms',
                    MessageStatus.failed,
                    0,
                  );
                  cy.visit(fixture.url).then(() => {
                    checkMessageHistoryPopup(
                      registrationNoWhatsapp,
                      customLabel,
                      fixture.messageText,
                      'sms',
                      MessageStatus.sent,
                      1,
                    );
                  });
                });
              });
            });
          });
        });
      },
    );
  });

  const checkPATable = (
    fixture: any,
    messageStatus: string,
    messageType: string,
    interceptId = 'textmessage',
  ) => {
    cy.wait(`@${interceptId}`); // Wait for textmessage cy intercept to complete
    cy.setHoPortal();
    cy.visit(fixture.url).then(() => {
      cy.get('.proxy-scrollbar').scrollTo('right', {
        easing: 'linear',
        duration: 100,
      });
      cy.get('[data-cy="message-history-button"]').contains(messageType, {
        matchCase: false,
      });
      cy.get('[data-cy="message-history-button"]').contains(messageStatus, {
        matchCase: false,
      });
    });
  };

  const checkMessageHistoryPopup = (
    registration: any,
    customLabel: string,
    messageText: string,
    messageType: string,
    messageStatus: MessageStatus,
    nEntry?: number,
  ) => {
    // Check headers
    cy.get('.proxy-scrollbar').scrollTo('right', {
      easing: 'linear',
      duration: 100,
    });
    cy.get('[data-cy="message-history-button"]').click();
    cy.get('.toolbar-title-default > .ion-color').contains(
      registration.nameFirst,
    );
    cy.get('.toolbar-title-default > .ion-color').contains(
      registration.nameLast,
    );

    // Set labels
    const messageHistoryEn =
      portalEn.page.program['program-people-affected']['message-history-popup'];
    let typeLabel;
    if (messageType === 'whatsapp') {
      typeLabel = messageHistoryEn.type.whatsapp;
    } else {
      typeLabel = messageHistoryEn.type.sms;
    }
    const messageTextSub = messageText.substring(0, 20);
    // cy.get('[data-cy="message-history-row"]').contains(typeLabel)

    // Checks row
    if (isFinite(nEntry)) {
      cy.get('[data-cy="message-history-row"]')
        .eq(nEntry)
        .contains(customLabel);
      cy.get('[data-cy="message-history-row"]').eq(nEntry).contains(typeLabel);
      cy.get('[data-cy="message-history-row"]')
        .eq(nEntry)
        .contains(messageStatus, { matchCase: false });
      cy.get('[data-cy="message-history-accordion"]')
        .eq(nEntry)
        .contains(messageTextSub);
      cy.get('[data-cy="message-history-accordion"]').eq(nEntry).click();
      cy.get('[data-cy="message-history-accordion"]')
        .eq(nEntry)
        .contains(messageText.replace(/\n/g, ''));
    } else {
      cy.get('[data-cy="message-history-row"]').contains(customLabel);
      cy.get('[data-cy="message-history-row"]').contains(typeLabel);
      cy.get('[data-cy="message-history-row"]').contains(messageStatus, {
        matchCase: false,
      });
      cy.get('[data-cy="message-history-accordion"]').contains(messageTextSub);
      cy.get('[data-cy="message-history-accordion"]').click();
      cy.get('[data-cy="message-history-accordion"]').contains(
        messageText.replace(/\n/g, ''),
      );
    }
  };
});
