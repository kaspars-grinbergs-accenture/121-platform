@ho-portal
Feature: Manage payment via import and export

  Background:
    Given an FSP of integration type "csv" or "xml"
    Given at least 1 payment is done for the program

  Scenario: Export payment instructions for FSP without reconciliation
    Given a logged-in user with "PaymentFspInstructionREAD" permissions
    When the user selects a "closed" payment from the dropdown-list
    Then the "export payment instructions" button is enabled
    When the user clicks the "export payment instructions" button
    Then an confirm popup opens with a description
    And it shows an 'action done last on' timestamp if available
    When the user confirms
    Then an Excel-file is dowloaded
    And it shows a list of the registrations that were "included" for this payment
    And "transaction" information where the "amount" is the multiplication of the PA's "paymentAmountMultiplier" and the supplied "transfer value"
    And all data as programmed for this FSP

  Scenario: Export payment instructions for FSP WITH reconciliation
    Given everything the same as in previous scenario
    When the user clicks the "export payment instructions" button
    Then a difference is that only 'waiting' transactions are included, instead of all
    And an XML is downloaded instead of Excel
    And this difference is also explained in the export popup

  Scenario: Successfully import payment reconciliation data
    Given a logged-in user with "PaymentCREATE" permissions
    Given a correct XML-file
    When the user selects a "closed" payment from the dropdown-list
    Then the "import payment reconciliation data" button is enabled
    When the user clicks the button
    Then a filepicker popup opens
    And it shows an 'action done last on' timestamp if available
    When an XML-file is chosen and confirmed
    Then the file is processed
    And an popup appears which confirms the total number of updated 'waiting' transactions
    And splits them out in 'to success' and 'to waiting'
    And it mentions 'not found' records, if any.

  Scenario: Unsuccessfully import payment reconciliation data
    Given an incorrect XML-file
    When an XML-file is chosen and confirmed
    Then a popup appears that 'something went wrong with the import'

