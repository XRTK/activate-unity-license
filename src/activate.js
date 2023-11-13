const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const fs = require("fs");
const path = require('path');
const { readdir } = require('fs/promises');
const { Activator } = require('./unity-activator/activator');

async function Run() {
    try {
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

        var pwsh = await io.which("pwsh", true);
        var unity_action = path.resolve(__dirname, 'unity-action.ps1');
        var licenseType = core.getInput('license-type');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
            var serial = core.getInput('serial');

            if (!serial) {
                throw Error('Missing serial input');
            }

            // Unity only likes to mask the last 4 characters of serial.
            // Let's mask all of it.
            var maskedSerial = serial.slice(0, -4) + `XXXX`;
            core.setSecret(maskedSerial);
            core.startGroup(`Activate Unity Professional License`);
            var args = `-quit -nographics -batchmode -serial ${serial} -username ${username} -password ${password}`;
            var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName ProLicenseActivation`);
            core.endGroup();
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using requesting activation file
            core.startGroup(`Generate Unity License Request File`);
            var exitCode = 0;
            var args = `-quit -nographics -batchmode -createManualActivationFile`;
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
                key: '',
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
            args = `-quit -nographics -batchmode -manualLicenseFile ""${ulfPath}""`;

            try {
                exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName PersonalLicenseActivation`);
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
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
    }
};

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
        for(const subDir of directories) {
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

module.exports = { Run }