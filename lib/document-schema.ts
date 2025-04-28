// This file contains the document schema for different countries
// It's based on the JSON schema provided in the requirements

export const documentSchema: Record<string, Record<string, string[]>> = {
  India: {
    CompanyDocuments: [
      "Certificate of Incorporation",
      "PAN Card",
      "TAN Registration Certificate",
      "GST Registration Certificate",
      "MOA and AOA",
      "Business/Trade License",
      "Shops & Establishment Registration",
      "Professional Tax Registration",
      "Import Export Code (IEC)",
      "Annual Financial Statements",
      "Tax Audit Reports (Form 3CA/3CB & 3CD)",
      "Income Tax Returns (ITR copies)",
      "GST Returns (GSTR-1, GSTR-3B, GSTR-9)",
      "PF and ESI Registration",
      "PF and ESI Challans and Returns",
      "Board Resolutions",
      "Director KYC (DIR-3)",
    ],
    EmployeeDocuments: [
      "PAN Card",
      "Aadhaar Card",
      "Form 16",
      "Salary Slips",
      "Bank Statements",
      "Investment Proofs",
      "Previous Employment Form 16",
      "Medical Insurance Proof",
      "Rent Receipts",
      "Loan Certificates",
      "LTA Proofs",
    ],
  },
  Germany: {
    CompanyDocuments: [
      "Trade Registration Certificate",
      "VAT Registration",
      "Articles of Association",
      "Handelsregisterauszug",
      "Annual Financial Statements",
      "Tax Number Assignment Letter",
      "Tax Assessment Notices",
      "VAT Returns",
      "Social Security Registration",
    ],
    EmployeeDocuments: [
      "Steueridentifikationsnummer",
      "Sozialversicherungsausweis",
      "Salary Certificates",
      "ELSTER Reports",
      "Health Insurance Certificate",
      "Lohnsteuerbescheinigung",
      "Previous Employer Salary Proof",
      "Pension Contribution Proofs",
    ],
  },
  China: {
    CompanyDocuments: [
      "Business License",
      "Organization Code Certificate",
      "Tax Registration Certificate",
      "Social Insurance Registration",
      "VAT Registration Certificate",
      "Financial Statements",
      "Corporate Income Tax Return",
      "VAT Returns",
      "Tax Clearance Certificate",
    ],
    EmployeeDocuments: [
      "National ID Card",
      "Labor Contract Copy",
      "Payslips",
      "IIT Payment Certificates",
      "Social Insurance Contribution Record",
      "Housing Provident Fund Contribution Proof",
      "Previous Employer Income Proof",
      "Residence Permit",
    ],
  },
  USA: {
    CompanyDocuments: [
      "Certificate of Incorporation / Formation",
      "EIN",
      "State Tax Registration Certificate",
      "IRS Tax Filings",
      "Financial Statements",
      "State Annual Reports",
      "W-2 Forms for employees",
      "1099 Forms for contractors",
      "Payroll Tax Returns",
      "Sales Tax Registration and Returns",
    ],
    EmployeeDocuments: [
      "Social Security Number (SSN)",
      "W-2 Forms",
      "1099-NEC",
      "Paystubs",
      "Investment Proofs",
      "Health Insurance Documents",
      "Previous Employer Pay Records",
      "Mortgage or Student Loan Interest Statements",
    ],
  },
  Japan: {
    CompanyDocuments: [
      "Certificate of Registered Matters",
      "Corporate Number Notification",
      "Articles of Incorporation",
      "Business License",
      "Tax Payment Slips",
      "Consumption Tax Return",
      "Financial Statements",
      "Annual Corporate Tax Return",
      "Labor Insurance Registration Certificate",
      "Social Insurance Participation Certificate",
    ],
    EmployeeDocuments: [
      "My Number Card",
      "Gensen Chōshūhyō",
      "Salary Statements",
      "Health Insurance Card",
      "Employment Contract",
      "Residence Card",
      "Previous Employer Gensen Chōshūhyō",
    ],
  },
  UAE: {
    CompanyDocuments: [
      "Trade License",
      "VAT Registration Certificate",
      "Corporate Bank Account Proof",
      "Memorandum of Association (MOA)",
      "Certificate of Incorporation",
      "Lease Agreement (Ejari)",
      "Financial Audit Reports",
      "VAT Returns Filing Receipts",
      "UBO Declaration",
    ],
    EmployeeDocuments: [
      "Emirates ID",
      "Labor Contract",
      "Passport Copy",
      "Visa Copy",
      "Salary Certificates",
      "Payslips",
      "Health Insurance Card",
      "WPS Salary Transfer Proof",
      "End of Service Benefits Calculation Sheets",
    ],
  },
  SupportingDocumentsCommon: {
    Common: [
      "Tax Payment Receipts",
      "Previous Years' Tax Filing Receipts",
      "Tax Notices / Assessment Letters",
      "Bank Statements",
      "Proof of Foreign Income",
      "Advance Tax Challans",
      "Loan Statements",
      "Charitable Donation Receipts",
      "Investment Proofs",
      "Rental Income Proof",
    ],
  },
}

export default documentSchema

export interface Document {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  preview_url?: string;
  status: 'pending' | 'classified' | 'pending_review' | 'non_classified' | 'failed';
  country_of_origin: string | null;
  document_type: string | null;
  document_subtype: string | null;
  document_category: 'CompanyDocuments' | 'EmployeeDocuments';
  metadata: {
    companyName?: string;
    employeeName?: string;
    documentPurpose?: string;
    registrationNumber?: string;
    dateOfIssue?: string;
    validityPeriod?: string;
    jurisdictionalOffice?: string;
    confidence_score?: number;
    status?: string;
    status_changed_at?: string;
    status_changed_by?: string;
    classification_timestamp?: string;
    error?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  comments?: DocumentComment[];
  activity_log?: DocumentActivity[];
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_by: string;
  shared_with: string;
  created_at: string;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user?: {
    email: string;
    avatar?: string;
  };
}

export interface DocumentActivity {
  id: string;
  document_id: string;
  user_id: string;
  activity_type: string;
  activity_details: any;
  created_at: string;
}
