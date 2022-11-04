const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');
const glob = require('glob');

const { Activator } = require('unity-activate');

const main = async () => {
    try {
        var editorPath = core.getInput('editor-path');

        if (!editorPath) {
            throw Error("Missing editor-path input");
        }

        var licenseType = core.getInput('license-type');

        console.log(`Activating ${licenseType} Unity License`);

        var pwsh = await io.which("pwsh", true);
        var unity_action = path.resolve(__dirname, 'unity-action.ps1');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
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

            // -quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX
            var args = `-quit -batchmode -username ${username} -password ${password} -serial ${serial}`;
            var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName ProLicenseActivation`);

            if (exitCode != 0) {
                throw Error(`Failed to activate license! errorCode: ${exitCode}`);
            }
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using requesting activation file
            var args = "-batchmode -createManualActivationFile"

            var exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName PersonalLicenseRequest`);

            if (exitCode != 0) {
                throw Error(`Failed to generate license request! errorCode: ${exitCode}`);
            }

            var licenseRequestPath = path.resolve(__dirname, '*.alf');

            if (!licenseFilePath) {
                throw Error(`Failed to find generated license alf request file path`)
            }

            console.log(`alf file: ${licenseFilePath}`);

            await new Activator({
                file : licenseRequestPath,
                username : username,
                password : password,
                authKey : '',
                serial : serial,
                out : __dirname,
              }).run();

            var licenseFilePath = path.resolve(__dirname, '*.ulf');

            console.log(`ulf file: ${licenseFilePath}`);

            // "-batchmode -manualLicenseFile ./UnityLicenseRequest.ulf"
            args = `-quit -batchmode -manualLicenseFile \"${licenseFilePath}\"`;

            exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName PersonalLicenseActivation`);

            if (exitCode != 0) {
                throw Error(`Failed to activate license! errorCode: ${exitCode}`);
            }
        } else {
            core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`)
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();