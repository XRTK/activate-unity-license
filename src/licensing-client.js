const core = require('@actions/core');
const exec = require('@actions/exec');
const glob = require('@actions/glob');
const fs = require("fs");
const path = require('path');
const platform = process.platform;

async function getLicensingClient() {
    // Windows: <UnityEditorDir>\Data\Resources\Licensing\Client
    // macOS (Editor versions 2021.3.19f1 or later): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/MacOS/
    // macOS (Editor versions earlier than 2021.3.19f1): <UnityEditorDir>/Contents/Frameworks/UnityLicensingClient.app/Contents/Resources/
    // Linux: <UnityEditorDir>/Data/Resources/Licensing/Client
    const editorPath = platform !== 'darwin' ? path.resolve(process.env.UNITY_EDITOR_PATH, '..') : path.resolve(process.env.UNITY_EDITOR_PATH, '..', '..');
    const hubPath = path.resolve(process.env.UNITY_HUB_PATH, '..');
    const version = process.env.UNITY_EDITOR_VERSION || editorPath.match(/(\d+\.\d+\.\d+[a-z]?\d?)/)[0];
    core.info(`Unity Editor Path: ${editorPath}`);
    core.info(`Unity Version: ${version}`);

    if (!fs.existsSync(editorPath)) {
        throw Error(`Unity Editor not found at path: ${editorPath}`);
    }

    let licenseClientPath;
    const [major, minor, patch] = version.split('.');

    // if 2019.3 or older, use unity hub licensing client
    if (major < 2020) {
        // C:\Program Files\Unity Hub\UnityLicensingClient_V1
        // /Applications/Unity\ Hub.app/Contents/MacOS/Unity\ Hub/UnityLicensingClient_V1
        // ~/Applications/Unity\ Hub.AppImage/UnityLicensingClient_V1
        const hubPathPattern = path.resolve(hubPath, '**', 'UnityLicensingClient_V1');
        core.info(`Unity Hub Path Pattern: ${hubPathPattern}`);
        const globber = await glob.create(hubPathPattern);
        const files = await globber.glob();
        core.info(`Unity Hub Licensing Client Files: ${files}`);
        for (const file of files) {
            if (fs.existsSync(file)) {
                fs.access(file, fs.constants.X_OK);
                licenseClientPath = file;
                break;
            }
        }
        return licenseClientPath;
    }

    switch (platform) {
        case 'win32':
            licenseClientPath = path.resolve(editorPath, 'Data', 'Resources', 'Licensing', 'Client', "Unity.Licensing.Client.exe");
            break;
        case 'darwin':
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

    core.info(`Unity Licensing Client Path: ${licenseClientPath}`);

    if (!fs.existsSync(licenseClientPath)) {
        throw Error(`Unity Licensing Client not found at path: ${licenseClientPath}`);
    }

    return licenseClientPath;
};

function maskSerialInOutput(output) {
    return output.replace(/([\w-]+-XXXX)/g, (_, serial) => {
        const maskedSerial = serial.slice(0, -4) + `XXXX`;
        core.setSecret(maskedSerial);
        return serial;
    });
};

const client = undefined;

async function execWithMask(args) {
    let output = '';
    let exitCode = 0;
    try {
        if (client === undefined) {
            client = await getLicensingClient();
        }
        core.info(`[command]$"${client} ${args.join(' ')}`);
        exitCode = await exec.exec(client, args, {
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
            throw Error(maskSerialInOutput(output));
        } else {
            core.info(maskSerialInOutput(output));
        }
    }
};

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

function hasExistingLicense() {
    core.info('Checking for existing Unity License activation...');
    core.info(`Platform detected: ${platform}`);
    const paths = licensePaths[platform];
    core.info(`License paths: ${paths}`);
    if (!paths || paths.length < 2) {
        core.info(`No license paths configured for platform: ${platform} `);
        return false;
    }

    const [ulfDir, licensesDir] = paths.filter(Boolean);

    if (!ulfDir) {
        core.info(`ULF Directory is not defined for ${platform}`);
        return false;
    }

    if (!licensesDir) {
        core.info(`Licenses Directory is not defined for ${platform}`);
        return false;
    }

    core.info(`ULF Directory: ${ulfDir} `);
    core.info(`Licenses Directory: ${licensesDir} `);

    // if ulf directory doesn't exist, create it and give it permissions
    if (platform === 'darwin' && !fs.existsSync(ulfDir)) {
        core.info(`Creating Unity license directory: ${ulfDir} `);
        fs.mkdirSync(ulfDir, { recursive: true });
        fs.chmodSync(ulfDir, 0o777);
    }

    const ulfPath = path.resolve(ulfDir, 'Unity_lic.ulf');
    core.info(`ULF Path: ${ulfPath} `);

    try {
        if (fs.existsSync(ulfPath)) {
            core.info(`Found license file at path: ${ulfPath} `);
            return true;
        } else {
            core.info(`License file does not exist at path: ${ulfPath} `);
        }
    } catch (error) {
        core.info(`Error checking ulf path: ${error.message} `);
    }

    try {
        if (fs.existsSync(licensesDir)) {
            core.info(`Found licenses directory: ${licensesDir} `);
            return fs.readdirSync(licensesDir).some(f => f.endsWith('.xml'));
        } else {
            core.info(`Licenses directory does not exist: ${licensesDir} `);
        }
    } catch (error) {
        core.info(`Error checking licenses directory: ${error.message} `);
    }

    return false;
}

async function version() {
    await execWithMask([`--version`]);
}

async function showEntitlements() {
    await execWithMask([`--showEntitlements`]);
}

async function activateLicense(username, password, serial) {
    const args = [`--activate`, `--ulf--username`, `"${username}"`, `--password`, `"${password}"`];

    if (serial !== undefined && serial !== '') {
        args.push([`--serial`, `"${serial}"`]);
        const maskedSerial = serial.slice(0, -4) + `XXXX`;
        core.setSecret(maskedSerial);
    }

    await execWithMask(args);
}

async function returnLicense() {
    await execWithMask([`--return-ulf`]);
    await showEntitlements();
}

module.exports = { hasExistingLicense, version, showEntitlements, activateLicense, returnLicense };
