#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const activator_1 = require("./activator");
const cac_1 = __importDefault(require("cac"));
const get_package_version_1 = __importDefault(require("@jsbits/get-package-version"));
const cli = cac_1.default();
cli.command('[opts] <file>', 'Activate Unity activation license file (*.alf).\nNOTE: If two-factor authentication is enabled, the verify code will be requested.')
    .option('-o, --out <dir>', 'Output ulf file to the specified directory', { default: '.' })
    .option('-u, --username <username>', 'Username (email) to login Unity (default: $UNITY_USERNAME)')
    .option('-p, --password <password>', 'Password to login Unity (default: $UNITY_PASSWORD)')
    .option('-k, --key <key>', 'The authenticator key to login (default: $UNITY_KEY).')
    .option('-s, --serial <serial>', 'Serial key to activate. If empty, activate as personal license.\nNOTE: Unity Personal Edition is not available to companies or organizations that earned more than USD100,000 in the previous fiscal year.\n')
    .option('-d, --debug', 'Display additional log and dump content to \'error.html\' on error', { default: false })
    .option('--headful', 'Run "headful" puppeteer', { default: false })
    .action((file, __, options) => (async () => {
    options.username || (options.username = process.env.UNITY_USERNAME || '');
    options.password || (options.password = process.env.UNITY_PASSWORD || '');
    options.key || (options.key = process.env.UNITY_KEY || '');
    options.serial || (options.serial = process.env.UNITY_SERIAL || '');
    options.file = file;
    // [[CHECK]] input file name
    if (!/(Unity_v.*.alf|\.ilf)/.test(file)) {
        console.error(`Input activation license file should be named Unity_vX.alf or .ilf`);
        process.exit(1);
    }
    await new activator_1.Activator(options).run()
        .then(_ => process.exit(0))
        .catch(e => {
        console.error(e.message);
        console.error('Run `unity-activate --help` to show help.');
        process.exit(1);
    });
})());
cli.help()
    .version(get_package_version_1.default());
try {
    cli.parse();
}
catch (e) {
    console.error(e.message);
    console.error('Run `unity-activate --help` to show help.');
    process.exit(1);
}
//# sourceMappingURL=index.js.map