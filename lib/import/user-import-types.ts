export type UserImportPayload = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export type ParsedUserImportRow = UserImportPayload & {
  rowNumber: number;
  errors: string[];
};

export type UserImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; email: string; message: string }[];
};

export type RoleImportOption = {
  id: string;
  name: string;
  slug: string;
};
