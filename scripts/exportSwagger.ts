



import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { swaggerSpec } from '../src/docs/swaggerDefinition';

const outDir = path.join(__dirname, '..', 'docs');
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, 'openapi.json');
const yamlPath = path.join(outDir, 'openapi.yaml');

fs.writeFileSync(jsonPath, JSON.stringify(swaggerSpec, null, 2) + '\n', 'utf8');
fs.writeFileSync(yamlPath, YAML.stringify(swaggerSpec), 'utf8');

console.log(`OpenAPI spec exported to:\n  ${jsonPath}\n  ${yamlPath}`);
