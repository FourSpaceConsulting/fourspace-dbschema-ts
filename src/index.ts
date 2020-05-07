#!/usr/bin/env node

import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import path from 'path';
import program from 'commander';

import { writeFileSync } from 'fs';

// import { OracleSchemaBuilder } from './oracle-schema-builder';
import { parseDefinition } from './schema-parser';
import { ColumnType } from './model';
import { PostgresSchemaBuilder } from './postgres/postgres-schema-builder';
import { SequelizeBuilderImpl } from './sequelize-builder';
import { PostgresFunctionBuilder } from './postgres/postgres-function-builder';
import { PostgresTypescriptDaoBuilder } from './postgres/typescript/postgres-ts-dao-builder';
import { CodeWriter } from './postgres/typescript/code-writer';

clear();
console.log(
    chalk.red(
        figlet.textSync('dbschema-cli', { horizontalLayout: 'full' })
    )
);

program
    .version('0.0.1')
    .description("Create DB schema from generic description")
    .option('-s, --schema', 'Schema file')
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

try {
    const schemaLocation='C:/Users/fours/Development/spaces/thirdshift/database/schema.json';
    const sqlOutputLocation='C:/Users/fours/Development/spaces/thirdshift/database/thirdshift.sql';
    const definition = parseDefinition(schemaLocation);
    // console.log('DEfinition', definition);
    // DB Schema
    const builder = new PostgresSchemaBuilder(definition);
    const procBuilder = new PostgresFunctionBuilder(definition);
    // Code Generator
    const codeGenerator = new PostgresTypescriptDaoBuilder();
    // write
    writeFileSync(sqlOutputLocation, builder.createTables() + '\n' + procBuilder.createUpdateSchema());
    const code = codeGenerator.generateDaoCode(definition);
    const writer = new CodeWriter();
    writer.write(code);

} catch (e) {
    console.log();
    console.log(e.message);
    console.log(e);
}
