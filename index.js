const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');
const { readdir } = require('fs/promises');
const { Activator } = require('@emoko/unity-activate');

const main = async () => {
    try {
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

        var serial = core.getInput('serial');

        if (!serial) {
            throw Error('Missing serial input');
        }

        var licenseType = core.getInput('license-type');

        console.log(`Activating ${licenseType} Unity License`);

        var pwsh = await io.which("pwsh", true);
        var unity_action = path.resolve(__dirname, 'unity-action.ps1');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable

            // -quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX
            var args = `-quit -nographics -batchmode -username ${username} -password ${password} -serial ${serial}`;
            var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName ProLicenseActivation`);

            if (exitCode != 0) {
                throw Error(`Failed to activate license! errorCode: ${exitCode}`);
            }
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using requesting activation file
            var args = `-quit -nographics -batchmode -createManualActivationFile` //-username ${username} -password ${password}
            var exitCode = 0;

            try {
                exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName ManualLicenseRequest`);
            } catch (error) {
                console.error(error.message);
            }

            var files = await findByExtension(__dirname, '.alf');
            var alfPath = files[0];

            console.log(`alf Path: "${alfPath}"`);

            if (!alfPath) {
                throw Error(`Failed to find generated license alf request file!`)
            }

            await new Activator({
                file : alfPath,
                username : username,
                password : password,
                key : '', // use of 2FA isn't recommended for automated workflows
                serial : '', // intentionally left blank for personal license
                out : __dirname,
            })
            .run()
            .catch(e => {
                throw Error(e.message);
            });

            files = await findByExtension(__dirname, '.ulf');
            var ulfPath = files[0];

            console.log(`ulf file: "${ulfPath}"`);

            if (!ulfPath) {
                throw Error(`Failed to find manual license ulf file!`)
            }

            // "-batchmode -manualLicenseFile ./UnityLicenseRequest.ulf"
            args = `-quit -nographics -batchmode -manualLicenseFile \"${ulfPath}\"`;

            try {
                exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName PersonalLicenseActivation`);
            } catch (error) {
                throw Error(`Failed to activate license! ${error.message}`);
            }

            if (exitCode != 0) {
                throw Error(`Failed to activate license! errorCode: ${exitCode}`);
            }
        } else {
            core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`)
        }
    } catch (error) {
        core.setFailed(`Unity License Activation Failed! ${error.message}`);
    }
}

// Call the main function to run the action
main();

const findByExtension = async (dir, ext) => {
    const matchedFiles = [];
    const files = await readdir(dir);

    for (const file of files) {
        if (file.endsWith(ext)) {
            matchedFiles.push(path.resolve(dir, file));
        }
    }

    return matchedFiles;
};