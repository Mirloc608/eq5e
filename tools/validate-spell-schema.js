import Ajv from "ajv";
import { loadSchema } from "./schema-loader.js";

const ajv = new Ajv({ allErrors: true });
const schema = loadSchema("spell.json");

export function validateSpell(spell) {
  const validate = ajv.compile(schema);
  const valid = validate(spell.system);
  return { valid, errors: validate.errors || [] };
}
