import { DaoCode } from "../../dao-code-generator";
import { writeFileSync } from 'fs';
import * as CodeUtil from './code-definition-util';
import { paramCase } from 'change-case';

const codeOutputLocation = 'C:/Users/Richard/Documents/Dev/spaces/thirdshift/generated/';

export class CodeWriter {
    public write(code: Map<string, DaoCode>) {
        code.forEach((v, k) => {

            this.writeModel(k, v.model.code);
            this.writeDaoInterface(k, v.daoInterface);
            this.writeDao(k, v.daoImplementation, v.model.modelNames);
        });

    }

    private writeModel(k: string, code: string) {
        const modelPath = codeOutputLocation + paramCase(k) + '.ts'
        writeFileSync(modelPath, code);
    }

    private writeDaoInterface(k: string, code: string) {
        const path = codeOutputLocation + paramCase(k) + '-dao.ts'

        const modelName = CodeUtil.getObjectName(k);
        const modelFileSuffix = paramCase(modelName);
        const output = `
import {${modelName}} from './${modelFileSuffix}'
${code}
        `;
        writeFileSync(path, output);
    }

    private writeDao(k: string, code: string, modelNames: readonly string[]) {
        const path = codeOutputLocation + paramCase(k) + '-db-dao.ts'
        const modelFileSuffix = paramCase(k).toLowerCase();

        const modelImports = modelNames.join(',');
        const modelName = CodeUtil.getObjectName(k);
        const daoFileSuffix = paramCase(modelName) + '-dao';
        const output = `
import {${modelImports}} from './${modelFileSuffix}';
import {${modelName}Dao} from './${daoFileSuffix}';
import { toMilliUtcString } from './../../utils/format-util';
import { throwResourceNotFoundError } from './../../utils/error-handler';
import { DbInterfaceProvider } from '../access/db-interface-provider';

${code}
        `;
        writeFileSync(path, output);
    }


}