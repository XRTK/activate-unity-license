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
        var editorPath = "TEST_EDITOR_PATH";//core.getInput('editor-path');

        if (!editorPath) {
            throw Error("Missing editor-path input");
        }

        var licenseType = core.getInput('license-type');

        console.log(`Activating ${licenseType} Unity License`);

        var pwsh = await io.which("pwsh", true);

        if (licenseType.toLowerCase().startsWith('pro')) {
            // if pro/plus license activate by using UNITY_SERIAL env variable
            var activatePro = path.resolve(__dirname, 'activate-pro-license.ps1');
            await exec.exec(`"${pwsh}" -Command`, `${activatePro} -EditorPath "${editorPath}"`);
        } else if (licenseType.toLowerCase().startsWith('per')) {
            // if personal license activate by using UNITY_PERSONAL_LICENSE env variable
            var activatePersonal = path.resolve(__dirname, 'activate-personal-license.ps1');
            await exec.exec(`"${pwsh}" -Command`, `${activatePersonal} -EditorPath "${editorPath}"`);
        } else {
            core.setFailed(`Invalid License type provided: '${licenseType}' | expects: 'professional' or 'personal'`)
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();