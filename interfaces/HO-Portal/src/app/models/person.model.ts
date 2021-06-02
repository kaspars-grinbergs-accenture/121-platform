// Model for data from the API
export class Person {
  id: number;
  referenceId: string;
  phoneNumber?: string;
  inclusionScore?: number;
  name?: string;
  created?: string;
  importedDate?: string;
  invitedDate?: string;
  noLongerEligibleDate?: string;
  appliedDate?: string;
  selectedForValidationDate?: string;
  validationDate?: string;
  inclusionDate?: string;
  inclusionEndDate?: string;
  rejectionDate?: string;
  status: PaStatus;
  fsp?: string;
  vnumber?: string;
  whatsappPhoneNumber?: string;
  namePartnerOrganization?: string;
  paymentAmountMultiplier?: number;
}

// Model for display (in table)
export class PersonRow {
  referenceId: string;
  checkboxVisible: boolean;
  pa: string; // Display label
  status: PaStatus; // Not displayed in table, but needed e.g. for updateCheckboxes
  statusLabel: string;
  digitalIdCreated?: string;
  vulnerabilityAssessmentCompleted?: string | null;
  selectedForValidation?: string | null;
  vulnerabilityAssessmentValidated?: string | null;
  inclusionScore?: number;
  included?: string | null;
  rejected?: string | null;
  inclusionEnded?: string | null;
  imported?: string | null;
  invited?: string | null;
  markedNoLongerEligible?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  fsp?: string | null;
  vnumber?: string | null;
  whatsappPhoneNumber?: string | null;
  namePartnerOrganization?: string | null;
  paymentAmountMultiplier?: string | null;
}

export enum PaStatus {
  imported = 'imported',
  invited = 'invited',
  noLongerEligible = 'noLongerEligible',
  created = 'created',
  registered = 'registered',
  selectedForValidation = 'selectedForValidation',
  registeredWhileNoLongerEligible = 'registeredWhileNoLongerEligible',
  validated = 'validated',
  included = 'included',
  inclusionEnded = 'inclusionEnded',
  rejected = 'rejected',
}

export class Note {
  public note: string;
  public noteUpdated: string;
}
