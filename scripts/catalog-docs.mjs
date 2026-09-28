import fs from 'node:fs/promises';
import {catalogueMarkdown} from '../src/catalog/index.js';
await fs.mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../docs/features.md',import.meta.url),catalogueMarkdown());
