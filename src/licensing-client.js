const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require("fs");
const path = require('path');
const platform = process.platform;

const getLicensingClient = () => {
    // Windows: <UnityEditorDir>\Data\Resources\Licensing\Client
    // macOS (Editor versions 2021.3.19f1 or later): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/
    // macOS (Editor versions earlier than 2021.3.19f1): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/Resources/
    // Linux: <UnityEditorDir>/Data/Resources/Licensing/Client
    const editorPath = platform !== 'darwin' ? path.resolve(process.env.UNITY_EDITOR_PATH, '..') : path.resolve(process.env.UNITY_EDITOR_PATH, '..', '..');
    const version = process.env.UNITY_EDITOR_VERSION || editorPath.match(/(\d+\.\d+\.\d+[a-z]?\d?)/)[0];
    core.debug(`Unity Editor Path: ${editorPath}`);
    core.debug(`Unity Version: ${version}`);

    if (!fs.existsSync(editorPath)) {
        throw Error(`Unity Editor not found at path: ${editorPath}`);
    }

    let licenseClientPath;

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

const maskSerialInOutput = (output) => {
    const serialPattern = /([\w-]+-XXXX)/g;
    return output.replace(serialPattern, (_, serial) => {
        const maskedSerial = serial.slice(0, -4) + `XXXX`;
        core.setSecret(maskedSerial);
        return serial;
    });
};

const client = getLicensingClient();

async function execWithMask(command) {
    let output = '';
    let exitCode = 0;
    try {
        exitCode = await exec.exec(command, [], {
            silent: true,
            listeners: {
                stdout: (data) => {
                    output += data.toString();
                },
                stderr: (data) => {
                    output += data.toString();
                }
            }
        });

    } finally {
        if (exitCode !== 0) {
            throw Error(`${output}`);
        } else {
            core.info(maskSerialInOutput(output));
        }
    }
};

function hasExistingLicense() {
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
    } catch (error) {
        core.debug(`Error checking ulf path: ${error.message}`);
    }

    try {
        if (fs.existsSync(licensesDir)) {
            core.debug(`Found licenses directory: ${licensesDir}`);
            return fs.readdirSync(licensesDir).some(f => f.endsWith('.xml'));
        } else {
            core.debug(`Licenses directory does not exist: ${licensesDir}`);
        }
    } catch (error) {
        core.debug(`Error checking licenses directory: ${error.message}`);
    }

    return false;
}

async function version() {
    await execWithMask(`"${client}" --version`);
}

async function showEntitlements() {
    await execWithMask(`"${client}" --showEntitlements`);
}

async function activateLicense(username, password, serial) {
    let args = `--activate-ulf --username "${username}" --password "${password}"`;

    if (serial !== undefined && serial !== '') {
        args += ` --serial "${serial}"`;
        const maskedSerial = serial.slice(0, -4) + `XXXX`;
        core.setSecret(maskedSerial);
    }

    await execWithMask(`"${client}" ${args}`);
}

async function returnLicense() {
    await execWithMask(`"${client}" --return-ulf`);
    await showEntitlements();
}

module.exports = { hasExistingLicense, version, showEntitlements, activateLicense, returnLicense };
