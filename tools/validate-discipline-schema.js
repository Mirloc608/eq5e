import Ajv from "ajv";
import { loadSchema } from "./schema-loader.js";

const ajv = new Ajv({ allErrors: true });
const schema = loadSchema("discipline.json");

export function validateDiscipline(dicipline) {
  const validate = ajv.compile(schema);
  const valid = validate(discipline.system);
  return { valid, errors: validate.errors || [] };
}
