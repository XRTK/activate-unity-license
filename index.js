const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');
const { env } = require('process');

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
            await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs ${args} -logName ProLicenseActivation`);
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using UNITY_PERSONAL_LICENSE env variable
            var generateUlf = path.resolve(__dirname, 'generate-ulf.ps1');
            var licenseFilePath = path.resolve(__dirname, 'license.ulf');
            var licenseInfo = core.getMultilineInput('license');

            if (!licenseInfo) {
                throw Error('Missing license input');
            }

            await exec.exec(`"${pwsh}" -Command`, `${generateUlf} -path "${licenseFilePath}" -licenseInfo "${licenseInfo}"`);

            // "-batchmode -manualLicenseFile ./UnityLicenseRequest.ulf"
            var args = `-batchmode -manualLicenseFile "${licenseFilePath}"`;
            await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs ${args} -logName PersonalLicenseActivation`);
        } else {
            core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`)
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();