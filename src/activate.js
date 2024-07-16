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
                var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs "${args}" -logName ProLicenseActivation`);
                core.endGroup();
            } else if (licenseType.toLowerCase().startsWith('per')) {
                // if personal license activate by using requesting activation file
                core.startGroup(`Generate Unity License Request File`);
                var exitCode = 0;
                var args = `-quit -createManualActivationFile`;
                try {
                    exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs "${args}" -logName ManualLicenseRequest`);
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
                var ulfPath = files[0];

                core.debug(`ulf file: "${ulfPath}"`);

                if (!ulfPath) {
                    throw Error(`Failed to find manual license ulf file!`);
                }

                core.startGroup(`Activate Unity Personal License`);
                args = `-quit -manualLicenseFile ""${ulfPath}""`;

                try {
                    exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs "${args}" -logName PersonalLicenseActivation`);
                } catch (error) {
                    //console.error(error.message);
                }

                // cleanup
                fs.unlink(alfPath, () => core.debug(`removed: ${alfPath}`));
                fs.unlink(ulfPath, () => core.debug(`removed: ${ulfPath}`));

                core.endGroup();
            } else {
                core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`);
            }
        }, 3);
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
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
            path.resolve(process.env.PROGRAMDATA || '', 'Unity', 'Unity_lic.ulf'),
            path.resolve(process.env.LOCALAPPDATA || '', 'Unity', 'licenses')
        ],
        darwin: [
            path.resolve('/Library', 'Application Support', 'Unity', 'Unity_lic.ulf'),
            path.resolve('/Library', 'Unity', 'licenses')
        ],
        linux: [
            path.resolve(process.env.HOME || '', '.local/share/unity3d/Unity/Unity_lic.ulf'),
            path.resolve(process.env.HOME || '', '.config/unity3d/Unity/licenses')
        ]
    };

    const platform = process.platform;
    core.debug(`Platform: ${platform}`);
    const paths = licensePaths[platform];

    if (!paths) {
        core.debug(`No license paths configured for platform: ${platform}`);
        return false;
    }

    const [ulfPath, licensesDir] = paths;
    core.debug(`ULF Path: ${ulfPath}`);
    core.debug(`Licenses Directory: ${licensesDir}`);

    try {
        if (ulfPath && fs.existsSync(ulfPath)) {
            core.debug(`Found license file at path: ${ulfPath}`);
            return true;
        }
    } catch (err) {
        core.debug(`Error checking ulf path: ${err.message}`);
    }

    try {
        if (licensesDir && fs.existsSync(licensesDir)) {
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

module.exports = { Run };