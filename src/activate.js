const core = require('@actions/core');
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
            await licenseClient.version();
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

        const serial = core.getInput('serial');
        const licenseType = core.getInput('license-type');

        if (licenseType.toLowerCase().startsWith('pro') && !serial) {
            throw Error('Missing serial input');
        }

        await licenseClient.activateLicense(username, password, serial);

        if (!licenseClient.hasExistingLicense()) {
            throw Error('Unable to find Unity License!');
        }

        await licenseClient.showEntitlements();
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
