const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

const main = async () => {
    try {
        var licenseType = core.getInput('license-type');
        console.log(`Activating ${licenseType} Unity License`);

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
            await exec.exec(`pwsh`, [`-f`, `echo hello world!`]);
            console.log('-quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX');
            // -quit -batchmode -username name@example.com -password XXXXXXXXXXXXX -serial E3-XXXX-XXXX-XXXX-XXXX-XXXX
        } else if (licenseType.toLowerCase().startsWith('per')) {
            console.log('-batchmode -manualLicenseFile UnityLicenseRequest.ulf');
            // if personal license activate by using UNITY_PERSONAL_LICENSE env variable
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