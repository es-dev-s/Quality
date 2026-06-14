import type {
  BusinessType,
  InteractionConfig,
  LOBConfig,
} from "@/lib/audit/types";

export const AGENTS = [
  "Abhishek Sunuwar",
  "Adish Kunwar",
  "Bikash Bishwokarma",
  "Dikshya Sharma",
  "Kripa Dhakal",
  "Mahima Shrestha",
  "Milan Karki",
  "Prasiddha Bhattarai",
  "Prasuna Poudel",
  "Rachhya Sherchan",
  "Riya Awal",
  "Sagar Godar",
  "Sakshi Bhaukajee",
  "Supriya Khadka",
] as const;

export const SUPERVISORS = [
  "Manali Jadhav",
  "Samikshya Basnet",
  "Shishir Khadka",
] as const;

export const AUDITORS = ["Belina"] as const;

const LOB_MAP: Record<string, string[]> = {
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
    "Store / Ordering",
  ],
  POSTPAY: [
    "General management",
    "Refund/Claims",
    "Pricing request",
    "Numbers management",
    "Access management",
    "Device request",
    "Contract Renewal",
    "CRM",
    "Credit",
    "Billing/payment",
  ],
  PREPAID: [
    "Account-Phone Number Status",
    "Refusal",
    "Refund",
    "Store & Ordering",
    "Services and Features",
  ],
  OTHERS: ["Other"],
  GRACE: ["Document required"],
};

const LOB_REASONS: Record<string, string[]> = {
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
    "C-Transactions details mismatch",
  ],
  POSTPAY: [
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
    "C-Disputed invoice query",
  ],
  PREPAID: [
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
    "C-Number Port-in",
  ],
  OTHERS: ["Other"],
  GRACE: ["C-KYC Verification", "C-Business verification"],
};

const SUBLOB_REASONS: Record<string, string[]> = {
  "Account Management": [
    "C-Login Issues",
    "C-Navigation Assistance",
    "C-Unable to change Plan",
    "C-Unable to add members",
    "C-Number Management",
    "C-Unable to assign Number",
    "C-Unable to remove Members",
    "C-Account Setup queries",
    "C-Session expiry issue",
  ],
  "Account status": [
    "C-Account status issue",
    "C-Problem with Payment",
    "C-Payment Decline",
    "C-Billing Information Discrepancy",
  ],
  "User sync query": ["C-Users List issue"],
  Callback: ["C-Callback request"],
  "Call issue": [
    "C-Call Connectivity Issue",
    "C-Voice quality",
    "C-Incoming/Outgoing calls",
  ],
  "SMS Issue": ["C-SMS OTP issues", "C-Activates/verify"],
  "Integration issue": [
    "C-Connection/Layout Issues",
    "C-Layout syncing",
  ],
  "System Error": [
    "C-Internal server error",
    "C-White screen / loading issue",
  ],
  "SIP issues": ["C-SIP register device", "C-Calls disconnect error"],
  "Store / Ordering": [
    "C-Orders issues / purchasing",
    "C-Transactions details mismatch",
  ],
  "General management": [
    "C-Plan change",
    "C-Company Transfer",
    "C-Plan upgrade/downgrade",
    "C-Subscription cancellation",
    "C-Unlinking / deleting profile",
    "C-Request closure of account",
  ],
  "Refund/Claims": ["C-Refund request", "C-Cancellation request"],
  "Pricing request": ["C-Price Match Request"],
  "Numbers management": [
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in",
  ],
  "Access management": ["C-IP Whitelisting"],
  "Device request": ["C-Desk phone configuration"],
  "Contract Renewal": ["C-Contract renewal"],
  CRM: ["C-CRM Integration request"],
  Credit: ["C-Credit card issues / Query", "C-Refunds related to Credit"],
  "Billing/payment": [
    "C-Billing query",
    "C-Waiver request",
    "C-Dispute on charges",
    "C-Disputed invoice query",
  ],
  "Account-Phone Number Status": [
    "C-Status of Pending Number",
    "C-Status of Port-in",
    "C-Status of Port-out",
    "C-Status of Number release",
    "C-Details of Port-in/Port-out",
  ],
  Refusal: ["C-Identify declined queries"],
  Refund: ["C-Identify refund inquiries"],
  "Store & Ordering": ["C-Phone/Device queries"],
  "Services and Features": [
    "C-Caller CMS",
    "C-IP Whitelisting",
    "C-Desk Phone configuration",
    "C-CRM Integration request",
    "C-Number Purchase",
    "C-Number Release",
    "C-Number Port-in",
  ],
  Other: ["Other"],
  "Document required": ["C-KYC Verification", "C-Business verification"],
};

export const DEFAULT_BUSINESS_TYPES: BusinessType[] = ["Sales", "Support"];

function buildLob(name: string, businessType: BusinessType): LOBConfig {
  const sublobs = LOB_MAP[name] ?? [];
  const reasons = LOB_REASONS[name] ?? [];
  const sublobReasons: Record<string, string[]> = {};
  const sublobReasonSubReasons: Record<string, Record<string, string[]>> = {};
  for (const sub of sublobs) {
    sublobReasons[sub] = SUBLOB_REASONS[sub] ?? [];
    sublobReasonSubReasons[sub] = {};
  }
  return {
    name,
    sublobs,
    reasons,
    businessType,
    sublobReasons,
    sublobReasonSubReasons,
  };
}

function buildLobs(): LOBConfig[] {
  return DEFAULT_BUSINESS_TYPES.flatMap((businessType) =>
    Object.keys(LOB_MAP).map((name) => buildLob(name, businessType))
  );
}

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  agents: [],
  supervisors: [],
  auditors: [],
  businessTypes: [...DEFAULT_BUSINESS_TYPES],
  lobs: buildLobs(),
};

export {
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
  DEFAULT_TEMPLATE,
} from "@/lib/audit/rubrics";
