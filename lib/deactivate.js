const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const path = require('path');

async function Run() {
    try {
        var licenseType = core.getInput('license-type');
        console.log(`Returning ${licenseType} Unity License`);

        if (licenseType.toLowerCase().startsWith('pro')) {
            // return license if pro/plus

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
                exitCode = await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -projectPath "${__dirname}" -additionalArgs "${args}" -logName ReturnLicense`);
            } catch (error) {
                //console.error(error.message);
            }

            if (exitCode != 0) {
                throw Error(`Failed to deactivate license! errorCode: ${exitCode}`);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
};

module.exports = { Run }