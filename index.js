const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const io = require('@actions/io');
const fs = require('fs');
const os = require('os');
const { env } = require('process');
const path = require('path');

const main = async () => {
    try {
        var licenseType = core.getInput('license-type');
        var editorPath = core.getInput('editor-path');
        var projectPath = core.getInput('project-path');

        console.log(`Activating ${licenseType} Unity License`);
        var pwsh = await io.which("pwsh", true);
        var activate = path.resolve(__dirname, 'activate-license.ps1');
        await exec.exec(`"${pwsh}" -Command`, activate);

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
            console.log('-quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX');
            // -quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using UNITY_PERSONAL_LICENSE env variable
            console.log('-batchmode -manualLicenseFile UnityLicenseRequest.ulf');
            // -batchmode -manualLicenseFile .\UnityLicenseRequest.ulf
        } else {
            core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`)
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();