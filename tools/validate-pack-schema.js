import Ajv from "ajv";
import { loadSchema } from "./schema-loader.js";

const ajv = new Ajv({ allErrors: true });
const schema = loadSchema("pack.json");

export function validatePack(pack) {
  const validate = ajv.compile(schema);
  const valid = validate(pack.system);
  return { valid, errors: validate.errors || [] };
}
