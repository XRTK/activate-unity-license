const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const fs = require("fs");
const path = require('path');
const { readdir } = require('fs/promises');
const { Activator } = require('./unity-activator/activator');

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

        var projectPath = process.env.UNITY_PROJECT_PATH;

        if (!projectPath) {
            throw Error("Missing UNITY_PROJECT_PATH! Requires xrtk/unity-setup to run before this step.");
        }

        var username = core.getInput('username');

        if (!username) {
            throw Error('Missing username input');
        }

        var password = core.getInput('password');

        if (!password) {
            throw Error('Missing password input');
        }

        var authKey = core.getInput('auth-key');

        var pwsh = await io.which("pwsh", true);
        var unity_action = path.resolve(__dirname, 'unity-action.ps1');
        var licenseType = core.getInput('license-type');

        // if pro check serial input
        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
            var serial = core.getInput('serial');

            if (!serial) {
                throw Error('Missing serial input');
            }
        }

        await retry(async () => {
            if (licenseType.toLowerCase().startsWith('pro')) {
                // Unity only likes to mask the last 4 characters of serial.
                // Let's mask all of it.
                var maskedSerial = serial.slice(0, -4) + `XXXX`;
                core.setSecret(maskedSerial);
                core.startGroup(`Activate Unity Professional License`);
                var args = `-quit -serial ${serial} -username ${username} -password ${password}`;
                var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName ProLicenseActivation`);
                core.endGroup();
            } else if (licenseType.toLowerCase().startsWith('per')) {
                // if personal license activate by using requesting activation file
                core.startGroup(`Generate Unity License Request File`);
                var exitCode = 0;
                var args = `-quit -createManualActivationFile`;
                try {
                    exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName ManualLicenseRequest`);
                } catch (error) {
                    //console.error(error.message);
                }
                core.endGroup();

                var exeDir = path.resolve(process.cwd());
                core.debug(`exeDir: ${exeDir}`);
                var files = await findByExtension(exeDir, '.alf');
                var alfPath = files[0];

                core.debug(`alf Path: "${alfPath}"`);

                if (!alfPath) {
                    throw Error(`Failed to find generated license alf request file!`);
                }

                core.startGroup(`Download Unity License Activation File`);

                await new Activator({
                    file: alfPath,
                    debug: core.isDebug(),
                    username: username,
                    password: password,
                    key: authKey,
                    serial: '',
                    out: exeDir,
                })
                    .run()
                    .catch(e => {
                        core.error(e.message);
                    });

                core.endGroup();

                files = await findByExtension(exeDir, '.ulf');
                var ulfDir = files[0];

                core.debug(`ulf file: "${ulfDir}"`);

                if (!ulfDir) {
                    throw Error(`Failed to find manual license ulf file!`);
                }

                core.startGroup(`Activate Unity Personal License`);
                args = `-quit -manualLicenseFile ""${ulfDir}""`;

                try {
                    exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName PersonalLicenseActivation`);
                } catch (error) {
                    //console.error(error.message);
                }

                // cleanup
                fs.unlink(alfPath, () => core.debug(`removed: ${alfPath}`));
                fs.unlink(ulfDir, () => core.debug(`removed: ${ulfDir}`));

                core.endGroup();
            } else {
                core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`);
            }
        }, 3);
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
        PrintLogs();
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

    const platform = process.platform;
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

const PrintLogs = () => {
    // print Unity Hub and Unity.Licensing.Client logs
    // Window: C: \users\<yourusername>\AppData\Local\Unity\Unity.Licensing.Client.log
    // Mac: ~/Library/Logs/Unity/Unity.Licensing.Client.log
    // Linux: ~/.config/unity3d/Unity/Unity.Licensing.Client.log
    const licenseLogs = {
        win32: path.resolve(process.env.APPDATA || '', 'Unity', 'Unity.Licensing.Client.log'),
        darwin: path.resolve(process.env.HOME || '', 'Library', 'Logs', 'Unity', 'Unity.Licensing.Client.log'),
        linux: path.resolve(process.env.HOME || '', '.config', 'unity3d', 'Unity', 'Unity.Licensing.Client.log')
    };

    if (fs.existsSync(licenseLogs[process.platform])) {
        const logContent = fs.readFileSync(licenseLogs[process.platform], 'utf8');
        core.debug(`Unity Licensing Client Log: ${licenseLogs[process.platform]}\n${logContent}`);
    } else {
        core.warning(`Unity Licensing Client Log: ${licenseLogs[process.platform]} not found!`);
    }

    // The Hub log file (info-log.json):
    // Windows: C: \users\<yourusername>\AppData\Roaming\UnityHub\logs
    // Mac: ~/Library/Application Support/UnityHub/logs
    // Linux: ~/.config/UnityHub/logs
    const hubLogs = {
        win32: path.resolve(process.env.APPDATA || '', 'UnityHub', 'logs', 'info-log.json'),
        darwin: path.resolve(process.env.HOME || '', 'Library', 'Application Support', 'UnityHub', 'logs', 'info-log.json'),
        linux: path.resolve(process.env.HOME || '', '.config', 'UnityHub', 'logs', 'info-log.json')
    };

    if (fs.existsSync(hubLogs[process.platform])) {
        const logContent = fs.readFileSync(hubLogs[process.platform], 'utf8');
        core.debug(`Unity Hub Log: ${hubLogs[process.platform]}\n${logContent}`);
    } else {
        core.warning(`Unity Hub Log: ${hubLogs[process.platform]} not found!`);
    }
};

module.exports = { Run };