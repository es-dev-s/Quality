import bcrypt from "bcryptjs";
import { encryptPassword } from "@/lib/crypto/password-vault";

export async function buildPasswordCredentials(plainPassword: string) {
  return {
    password: await bcrypt.hash(plainPassword, 12),
    passwordEncrypted: encryptPassword(plainPassword),
  };
}
