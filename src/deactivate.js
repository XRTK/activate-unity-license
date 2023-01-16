const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');

async function Run() {
    try {
        var licenseType = core.getInput('license-type');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // return license if pro/plus
            core.startGroup(`Returning ${licenseType} Unity License`);

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
            // -quit -batchmode -nographics -returnlicense -username name@example.com -password XXXXXXXXXXXXX
            var args = `-quit -batchmode -nographics -returnlicense -username ${username} -password ${password}`;
            var exitCode = 0;

            try {
                exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${projectPath}" -additionalArgs "${args}" -logName ReturnLicense`);
            } catch (error) {
                console.error(error.message);
            }

            core.endGroup();

            if (exitCode != 0) {
                throw Error(`Failed to deactivate license! errorCode: ${exitCode}`);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
};

module.exports = { Run }