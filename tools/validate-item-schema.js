import Ajv from "ajv";
import { loadSchema } from "./schema-loader.js";

const ajv = new Ajv({ allErrors: true });
const schema = loadSchema("item.json");

export function validateItem(item) {
  const validate = ajv.compile(schema);
  const valid = validate(item.system);
  return { valid, errors: validate.errors || [] };
}
