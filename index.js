const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');
const { readdir } = require('fs/promises');

const { Activator } = require('unity-activate');

const main = async () => {
    try {
        var editorPath = core.getInput('editor-path');

        if (!editorPath) {
            throw Error("Missing editor-path input");
        }

        var username = core.getInput('username');

        if (!username) {
            throw Error('Missing username input');
        }

        var password = core.getInput('password');

        if (!password) {
            throw Error('Missing password input');
        }

        var licenseType = core.getInput('license-type');

        console.log(`Activating ${licenseType} Unity License`);

        var pwsh = await io.which("pwsh", true);
        var unity_action = path.resolve(__dirname, 'unity-action.ps1');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable

            var serial = core.getInput('serial');

            if (!serial) {
                throw Error('Missing serial input');
            }

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

            var alfPath = await findByExtension(__dirname, '.alf')[0];

            console.log(`License Request alf Path ${alfPath}`);

            if (!alfPath) {
                throw Error(`Failed to find generated license alf request file!`)
            }

            await new Activator({
                file : alfPath,
                username : username,
                password : password,
                authKey : '',
                serial : serial,
                out : __dirname,
              }).run();

            var ulfPath = await findByExtension(__dirname, '.ulf')[0];

            console.log(`ulf file: ${ulfPath}`);

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
        // Method 2:
        if (file.endsWith(`.${ext}`)) {
            matchedFiles.push(file);
        }
    }

    return matchedFiles;
};