const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const fs = require("fs");
const path = require('path');
const { readdir } = require('fs/promises');
const platform = process.platform;

async function retry(fn, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            await fn();
            return;
        } catch (error) {
            lastError = error;
            core.warning(`Attempt ${i + 1} failed: ${error.message}`);
            await new Promise(r => setTimeout(r, 2000 * i));
        }
    }
    throw lastError;
}

async function Run() {
    try {
        if (hasExistingLicense()) {
            core.info('Unity License already activated!');
            return;
        } else {
            core.info('Attempting to activate Unity License...');
        }

        var editorPath = process.env.UNITY_EDITOR_PATH;

        if (!editorPath) {
            throw Error("Missing UNITY_EDITOR_PATH! Requires xrtk/unity-setup to run before this step.");
        }

        var username = core.getInput('username');

        if (!username) {
            throw Error('Missing username input');
        }

        var password = core.getInput('password');

        if (!password) {
            throw Error('Missing password input');
        }

        var licenseClient = getLicensingClient();
        core.debug(`Unity Licensing Client Path: ${licenseClient}`);
        await exec.exec(`"${licenseClient}" --version`);

        var licenseType = core.getInput('license-type');
        var args = `--activate-ulf --username ${username} --password ${password}`;

        if (licenseType.toLowerCase().startsWith('pro')) {
            var serial = core.getInput('serial');

            if (!serial) {
                throw Error('Missing serial input');
            }

            var maskedSerial = serial.slice(0, -4) + `XXXX`;
            core.setSecret(maskedSerial);
            args += ` --serial ${serial}`;
        }

        await exec.exec(licenseClient, args);
        await new Promise(r => setTimeout(r, 3000));

        if (!hasExistingLicense()) {
            throw Error('Unable to find Unity License!');
        }

        var entitlements = '';
        await exec.exec(licenseClient, "--showEntitlements", {
            listeners: {
                stdout: (data) => {
                    entitlements += data.toString();
                }
            }
        });
        var serial = entitlements.match(/EntitlementGroupId: ([A-Z0-9-]+)/)[1];
        var maskedSerial = serial.slice(0, -4) + `XXXX`;
        core.setSecret(maskedSerial);
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
        GetLogs();
    }
}

const findByExtension = async (dir, ext) => {
    const directories = [];
    const matchedFiles = [];
    const files = await readdir(dir);

    for (const file of files) {
        const item = path.resolve(dir, file);

        if (fs.statSync(`${dir}/${file}`).isDirectory()) {
            directories.push(item);
        } else if (file.endsWith(ext)) {
            core.debug(`--> Found! ${item}`);
            matchedFiles.push(item);
            break;
        }
    }

    if (matchedFiles.length == 0) {
        for (const subDir of directories) {
            const nestedMatches = await findByExtension(subDir, ext);

            for (const nestedMatch of nestedMatches) {
                matchedFiles.push(nestedMatch);
                break;
            }
        }
    }

    return matchedFiles;
};

const findWorkspace = async (dir) => {
    core.debug(`Searching for .git root in: ${dir}`);
    const files = await readdir(dir);

    for (const file of files) {
        if (file.match('\.git')) {
            return path.resolve(dir);
        }
    }

    const result = await findWorkspace(path.resolve(dir, '..'));
    return result;
};

const getLicensingClient = () => {
    // Windows: <UnityEditorDir>\Data\Resources\Licensing\Client
    // macOS (Editor versions 2021.3.19f1 or later): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/
    // macOS (Editor versions earlier than 2021.3.19f1): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/Resources/
    // Linux: <UnityEditorDir>/Data/Resources/Licensing/Client
    var editorPath = platform !== 'darwin' ? path.resolve(process.env.UNITY_EDITOR_PATH, '..') : path.resolve(process.env.UNITY_EDITOR_PATH, '..', '..');
    const version = editorPath.match(/(\d+\.\d+\.\d+[a-z]?\d?)/)[0];
    core.debug(`Unity Editor Path: ${editorPath}`);
    core.debug(`Unity Version: ${version}`);

    if (!fs.existsSync(editorPath)) {
        throw Error(`Unity Editor not found at path: ${editorPath}`);
    }

    var licenseClientPath;

    switch (platform) {
        case 'win32':
            licenseClientPath = path.resolve(editorPath, 'Data', 'Resources', 'Licensing', 'Client', "Unity.Licensing.Client.exe");
            break;
        case 'darwin':
            const [major, minor, patch] = version.split('.');
            const isOlderThan2021_3_19 = major < 2021 || (major == 2021 && minor < 3) || (major == 2021 && minor == 3 && patch < 19);
            if (isOlderThan2021_3_19) {
                licenseClientPath = path.resolve(editorPath, 'Frameworks', 'UnityLicensingClient.app', 'Contents', 'Resources', 'Unity.Licensing.Client');
            } else {
                licenseClientPath = path.resolve(editorPath, 'Frameworks', 'UnityLicensingClient.app', 'Contents', 'MacOS', 'Unity.Licensing.Client');
            }
            break;
        case 'linux':
            licenseClientPath = path.resolve(editorPath, 'Data', 'Resources', 'Licensing', 'Client', "Unity.Licensing.Client");
            break;
        default:
            throw Error(`Unsupported platform: ${platform}`);
    }

    core.debug(`Unity Licensing Client Path: ${licenseClientPath}`);

    if (!fs.existsSync(licenseClientPath)) {
        throw Error(`Unity Licensing Client not found at path: ${licenseClientPath}`);
    }

    return licenseClientPath;
};

const hasExistingLicense = () => {
    core.debug('Checking for existing Unity License activation...');

    const licensePaths = {
        win32: [
            path.resolve(process.env.PROGRAMDATA || '', 'Unity'),
            path.resolve(process.env.LOCALAPPDATA || '', 'Unity', 'licenses')
        ],
        darwin: [
            path.resolve('/Library', 'Application Support', 'Unity') || '/Library/Application Support/Unity',
            path.resolve('/Library', 'Unity', 'licenses' || '/Library/Unity/licenses')
        ],
        linux: [
            path.resolve(process.env.HOME || '', '.local/share/unity3d/Unity'),
            path.resolve(process.env.HOME || '', '.config/unity3d/Unity/licenses')
        ]
    };

    core.debug(`Platform detected: ${platform}`);
    const paths = licensePaths[platform];
    core.debug(`License paths: ${paths}`);

    if (!paths || paths.length < 2) {
        core.debug(`No license paths configured for platform: ${platform}`);
        return false;
    }

    const [ulfDir, licensesDir] = paths.filter(Boolean);

    if (!ulfDir) {
        core.debug(`ULF Directory is not defined for ${platform}`);
        return false;
    }

    if (!licensesDir) {
        core.debug(`Licenses Directory is not defined for ${platform}`);
        return false;
    }

    core.debug(`ULF Directory: ${ulfDir}`);
    core.debug(`Licenses Directory: ${licensesDir}`);

    // if ulf directory doesn't exist, create it and give it permissions
    if (platform === 'darwin' && !fs.existsSync(ulfDir)) {
        core.debug(`Creating Unity license directory: ${ulfDir}`);
        fs.mkdirSync(ulfDir, { recursive: true });
        fs.chmodSync(ulfDir, 0o777);
    }

    const ulfPath = path.resolve(ulfDir, 'Unity_lic.ulf');
    core.debug(`ULF Path: ${ulfPath}`);

    try {
        if (fs.existsSync(ulfPath)) {
            core.debug(`Found license file at path: ${ulfPath}`);
            return true;
        } else {
            core.debug(`License file does not exist at path: ${ulfPath}`);
        }
    } catch (err) {
        core.debug(`Error checking ulf path: ${err.message}`);
    }

    try {
        if (fs.existsSync(licensesDir)) {
            core.debug(`Found licenses directory: ${licensesDir}`);
            return fs.readdirSync(licensesDir).some(f => f.endsWith('.xml'));
        } else {
            core.debug(`Licenses directory does not exist: ${licensesDir}`);
        }
    } catch (err) {
        core.debug(`Error checking licenses directory: ${err.message}`);
    }

    return false;
};

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
