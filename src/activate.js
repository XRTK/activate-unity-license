const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require("fs");
const path = require('path');
const licenseClient = require('./licensing-client');
const platform = process.platform;

async function Run() {
    try {
        if (licenseClient.hasExistingLicense()) {
            core.info('Unity License already activated!');
            return;
        } else {
            core.debug('Attempting to activate Unity License...');
            core.saveState('isPost', true);
        }

        const editorPath = process.env.UNITY_EDITOR_PATH;

        if (!editorPath) {
            throw Error("Missing UNITY_EDITOR_PATH!");
        }

        const username = core.getInput('username');

        if (!username) {
            throw Error('Missing username input');
        }

        const password = core.getInput('password');

        if (!password) {
            throw Error('Missing password input');
        }

        const client = licenseClient.getLicensingClient();
        core.debug(`Unity Licensing Client Path: ${client}`);
        await exec.exec(`"${client}" --version`);

        const licenseType = core.getInput('license-type');
        var args = `--activate-ulf --username "${username}" --password "${password}"`;

        if (licenseType.toLowerCase().startsWith('pro')) {
            const serial = core.getInput('serial');

            if (!serial) {
                throw Error('Missing serial input');
            }

            const maskedSerial = serial.slice(0, -4) + `XXXX`;
            core.setSecret(maskedSerial);
            args += ` --serial ${serial}`;
        }

        await exec.exec(`"${client}" ${args}`);

        if (!licenseClient.hasExistingLicense()) {
            throw Error('Unable to find Unity License!');
        }

        await exec.exec(`"${client}" --showEntitlements`);
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
        GetLogs();
    }
}

const GetLogs = () => {
    const licenseLogs = {
        win32: path.resolve(process.env.APPDATA || '', 'Unity', 'Unity.Licensing.Client.log'),
        darwin: path.resolve(process.env.HOME || '', 'Library', 'Logs', 'Unity', 'Unity.Licensing.Client.log'),
        linux: path.resolve(process.env.HOME || '', '.config', 'unity3d', 'Unity', 'Unity.Licensing.Client.log')
    };

    core.debug(`Unity Licensing Client Log: ${licenseLogs[platform]}`);

    if (fs.existsSync(licenseLogs[platform])) {
        copyFileToWorkspace(licenseLogs[platform], 'Unity.Licensing.Client.log');
    } else {
        core.warning(`Unity Licensing Client Log: ${licenseLogs[platform]} not found!`);
    }

    const hubLogs = {
        win32: path.resolve(process.env.APPDATA || '', 'UnityHub', 'logs', 'info-log.json'),
        darwin: path.resolve(process.env.HOME || '', 'Library', 'Application Support', 'UnityHub', 'logs', 'info-log.json'),
        linux: path.resolve(process.env.HOME || '', '.config', 'UnityHub', 'logs', 'info-log.json')
    };

    core.debug(`Unity Hub Log: ${hubLogs[platform]}`);

    if (fs.existsSync(hubLogs[platform])) {
        copyFileToWorkspace(hubLogs[platform], 'UnityHub.log');
    } else {
        core.warning(`Unity Hub Log: ${hubLogs[platform]} not found!`);
    }
};

const copyFileToWorkspace = (filePath, fileName) => {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const logPath = path.resolve(workspace, fileName);
    fs.copyFileSync(filePath, logPath);
};

module.exports = { Run };
