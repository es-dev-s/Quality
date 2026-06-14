import { AuditRecord, AuditTemplate } from "../types";

export const DEFAULT_TEMPLATE: AuditTemplate = {
  id: "default",
  name: "Standard Call / Chat Audit",
  type: "Call / Chat",
  lob: "Sales / Support",
  desc: "Default quality audit template — mirrors the current weighted scoring form.",
  isDefault: true,
  createdAt: "Built-in",
  sections: [
    {
      id: "s1",
      name: "Call Compliance",
      isFatal: false,
      params: [
        { id: "p-greeting", name: "Greeting", max: 2, cat: "Call Compliance", scoring: "Y/N/Fatal/NA" },
        { id: "p-permission", name: "Permission", max: 2, cat: "Call Compliance", scoring: "Y/N/NA" },
        { id: "p-closing", name: "Closing", max: 2, cat: "Call Compliance", scoring: "Y/N/NA" },
        { id: "p-hold", name: "Hold <=1min / 3x", max: 3, cat: "Call Compliance", scoring: "Y/N/NA" },
        { id: "p-transfer", name: "Transfer / Escalation", max: 2, cat: "Call Compliance", scoring: "Y/N/NA" },
      ],
    },
    {
      id: "s2",
      name: "Disposition",
      isFatal: false,
      params: [
        { id: "p-alltagged", name: "All Queries Tagged", max: 4, cat: "Disposition", scoring: "Y/N/Fatal/NA" },
        { id: "p-completetagging", name: "Complete Tagging", max: 4, cat: "Disposition", scoring: "Y/N/Fatal/NA" },
        { id: "p-correcttagging", name: "Correct Tagging", max: 6, cat: "Disposition", scoring: "Y/N/Fatal/NA" },
      ],
    },
    {
      id: "s3",
      name: "Call Etiquette",
      isFatal: false,
      params: [
        { id: "p-listening", name: "Active Listening", max: 6, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-empathy", name: "Empathy / Apology", max: 6, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-politeness", name: "Politeness", max: 6, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-language", name: "Preferred Language", max: 3, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-clarity", name: "Voice Clarity / Tone", max: 3, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-context", name: "Context Setting", max: 3, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
        { id: "p-grammar", name: "Grammar & Sentence", max: 6, cat: "Call Etiquette", scoring: "EE/ME/BE/NA" },
      ],
    },
    {
      id: "s4",
      name: "Query Resolution",
      isFatal: false,
      params: [
        { id: "p-probing", name: "Probing", max: 6, cat: "Query Resolution", scoring: "EE/ME/BE/NA" },
        { id: "p-correct", name: "Correct Resolution", max: 10, cat: "Query Resolution", scoring: "Y/N/Fatal/NA" },
        { id: "p-complete", name: "Complete Resolution", max: 10, cat: "Query Resolution", scoring: "Y/N/Fatal/NA" },
        { id: "p-complaint", name: "Complaint / Ticket Raised", max: 3, cat: "Query Resolution", scoring: "Y/N/NA" },
        { id: "p-tat", name: "TAT Informed", max: 3, cat: "Query Resolution", scoring: "Y/N/NA" },
        { id: "p-response", name: "Response Time <10s", max: 4, cat: "Query Resolution", scoring: "Y/N/NA" },
      ],
    },
    {
      id: "s5",
      name: "Sales & Compliance",
      isFatal: false,
      params: [
        { id: "p-upsell", name: "Upsell / Promotions", max: 4, cat: "Sales & Compliance", scoring: "Y/N/NA" },
        { id: "p-waiver", name: "Waiver / Discount", max: 2, cat: "Sales & Compliance", scoring: "Y/N/NA" },
      ],
    },
    {
      id: "s6",
      name: "CMM Compliance",
      isFatal: true,
      params: [
        { id: "p-rude", name: "Condescending / Rude / Abuse", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
        { id: "p-disconnect", name: "Disconnect Line", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
        { id: "p-pii", name: "Personal Info Violation", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
        { id: "p-wrongtag", name: "Complaints Tagged Wrongly", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
        { id: "p-blind", name: "Blind Transfer", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
        { id: "p-escalation", name: "Escalation Denied", max: 0, cat: "CMM Compliance", scoring: "Y/N-CMM" },
      ],
    },
  ],
};

export const PRELOADED_RECORDS: AuditRecord[] = [
  {
    id: 10001,
    savedAt: "2026-04-12",
    agent: "Mahima Shrestha",
    supervisor: "Manali Jadhav",
    auditor: "Belina",
    type: "Call",
    callDate: "2026-04-10",
    auditDate: "2026-04-12",
    lob: "Sales",
    sublob: "Lead Qualification - Call",
    mobile: "916393540300",
    reason: "Unpaid Signup",
    response: "Asked if the client is looking for any virtual number",
    qualityPct: 100,
    finalPct: 100,
    grade: "Excellent",
    gc: "green",
    qualityGrade: "Excellent",
    qualityGc: "green",
    hasFatal: false,
    fatalList: [],
    totalScored: 53,
    totalMax: 53,
    catScores: { "Call Compliance": { scored: 20, max: 20 }, "Call Etiquette": { scored: 27, max: 27 }, "Query Resolution": { scored: 6, max: 6 } },
    rows: [
      { id: "p-greeting", cat: "Call Compliance", name: "Greeting", max: 2, sel: "2", score: 2, fatal: false },
      { id: "p-permission", cat: "Call Compliance", name: "Permission", max: 2, sel: "2", score: 2, fatal: false },
      { id: "p-closing", cat: "Call Compliance", name: "Closing", max: 2, sel: "2", score: 2, fatal: false },
    ],
  },
  // ... Simplified for space, I will add more in the logic
];

export const AGENTS = [
  "Abhishek Sunuwar", "Adish Kunwar", "Bikash Bishwokarma",
  "Dikshya Sharma", "Kripa Dhakal", "Mahima Shrestha",
  "Milan Karki", "Prasiddha Bhattarai", "Prasuna Poudel",
  "Rachhya Sherchan", "Riya Awal", "Sagar Godar",
  "Sakshi Bhaukajee", "Supriya Khadka"
];

export const SUPERVISORS = ["Manali Jadhav", "Samikshya Basnet", "Shishir Khadka"];
export const AUDITORS = ["Belina"];

export const LOB_MAP: Record<string, string[]> = {
  "CORE LOB": [
    "Account Management",
    "Account status",
    "User sync query",
    "Callback",
    "Call issue",
    "SMS Issue",
    "Integration issue",
    "System Error",
    "SIP issues",
    "Store / Ordering"
  ],
  "POSTPAY": [
    "General management",
    "Refund/Claims",
    "Pricing request",
    "Numbers management",
    "Access management",
    "Device request",
    "Contract Renewal",
    "CRM",
    "Credit",
    "Billing/payment"
  ],
  "PREPAID": [
    "Account-Phone Number Status",
    "Refusal",
    "Refund",
    "Store & Ordering",
    "Services and Features"
  ],
  "OTHERS": [
    "Other"
  ],
  "GRACE": [
    "Document required"
  ]
};

export const REASON_MAP: Record<string, string[]> = {
  "CORE LOB": [
    "C-Login Issues",
    "C-Navigation Assistance",
    "C-Unable to change Plan",
    "C-Unable to add members",
    "C-Number Management",
    "C-Unable to assign Number",
    "C-Unable to remove Members",
    "C-Account Setup queries",
    "C-Session expiry issue",
    "C-Account status issue",
    "C-Problem with Payment",
    "C-Payment Decline",
    "C-Users List issue",
    "C-Billing Information Discrepancy",
    "C-Callback request",
    "C-Call Connectivity Issue",
    "C-Voice quality",
    "C-Incoming/Outgoing calls",
    "C-SMS OTP issues",
    "C-Activates/verify",
    "C-Connection/Layout Issues",
    "C-Layout syncing",
    "C-Internal server error",
    "C-White screen / loading issue",
    "C-SIP register device",
    "C-Calls disconnect error",
    "C-Orders issues / purchasing",
    "C-Transactions details mismatch"
  ],
  "POSTPAY": [
    "C-Plan change",
    "C-Company Transfer",
    "C-Plan upgrade/downgrade",
    "C-Subscription cancellation",
    "C-Unlinking / deleting profile",
    "C-Request closure of account",
    "C-Refund request",
    "C-Cancellation request",
    "C-Price Match Request",
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in",
    "C-IP Whitelisting",
    "C-Desk phone configuration",
    "C-Contract renewal",
    "C-CRM Integration request",
    "C-Credit card issues / Query",
    "C-Refunds related to Credit",
    "C-Billing query",
    "C-Waiver request",
    "C-Dispute on charges",
    "C-Disputed invoice query"
  ],
  "PREPAID": [
    "C-Status of Pending Number",
    "C-Status of Port-in",
    "C-Status of Port-out",
    "C-Status of Number release",
    "C-Details of Port-in/Port-out",
    "C-Identify declined queries",
    "C-Identify refund inquiries",
    "C-Phone/Device queries",
    "C-Caller CMS",
    "C-IP Whitelisting",
    "C-Desk Phone configuration",
    "C-CRM Integration request",
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in"
  ],
  "OTHERS": [
    "Other"
  ],
  "GRACE": [
    "C-KYC Verification",
    "C-Business verification"
  ]
};

export const SUB_LOB_REASON_MAP: Record<string, string[]> = {
  // CORE LOB:
  "Account Management": [
    "C-Login Issues",
    "C-Navigation Assistance",
    "C-Unable to change Plan",
    "C-Unable to add members",
    "C-Number Management",
    "C-Unable to assign Number",
    "C-Unable to remove Members",
    "C-Account Setup queries",
    "C-Session expiry issue"
  ],
  "Account status": [
    "C-Account status issue",
    "C-Problem with Payment",
    "C-Payment Decline",
    "C-Billing Information Discrepancy"
  ],
  "User sync query": [
    "C-Users List issue"
  ],
  "Callback": [
    "C-Callback request"
  ],
  "Call issue": [
    "C-Call Connectivity Issue",
    "C-Voice quality",
    "C-Incoming/Outgoing calls"
  ],
  "SMS Issue": [
    "C-SMS OTP issues",
    "C-Activates/verify"
  ],
  "Integration issue": [
    "C-Connection/Layout Issues",
    "C-Layout syncing"
  ],
  "System Error": [
    "C-Internal server error",
    "C-White screen / loading issue"
  ],
  "SIP issues": [
    "C-SIP register device",
    "C-Calls disconnect error"
  ],
  "Store / Ordering": [
    "C-Orders issues / purchasing",
    "C-Transactions details mismatch"
  ],

  // POSTPAY:
  "General management": [
    "C-Plan change",
    "C-Company Transfer",
    "C-Plan upgrade/downgrade",
    "C-Subscription cancellation",
    "C-Unlinking / deleting profile",
    "C-Request closure of account"
  ],
  "Refund/Claims": [
    "C-Refund request",
    "C-Cancellation request"
  ],
  "Pricing request": [
    "C-Price Match Request"
  ],
  "Numbers management": [
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in"
  ],
  "Access management": [
    "C-IP Whitelisting"
  ],
  "Device request": [
    "C-Desk phone configuration"
  ],
  "Contract Renewal": [
    "C-Contract renewal"
  ],
  "CRM": [
    "C-CRM Integration request"
  ],
  "Credit": [
    "C-Credit card issues / Query",
    "C-Refunds related to Credit"
  ],
  "Billing/payment": [
    "C-Billing query",
    "C-Waiver request",
    "C-Dispute on charges",
    "C-Disputed invoice query"
  ],

  // PREPAID:
  "Account-Phone Number Status": [
    "C-Status of Pending Number",
    "C-Status of Port-in",
    "C-Status of Port-out",
    "C-Status of Number release",
    "C-Details of Port-in/Port-out"
  ],
  "Refusal": [
    "C-Identify declined queries"
  ],
  "Refund": [
    "C-Identify refund inquiries"
  ],
  "Store & Ordering": [
    "C-Phone/Device queries"
  ],
  "Services and Features": [
    "C-Caller CMS",
    "C-IP Whitelisting",
    "C-Desk Phone configuration",
    "C-CRM Integration request",
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in"
  ],

  // OTHERS:
  "Other": [
    "Other"
  ],

  // GRACE:
  "Document required": [
    "C-KYC Verification",
    "C-Business verification"
  ]
};

