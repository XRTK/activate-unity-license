const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

const main = async () => {
    try {
        var licenseType = core.getInput('license-type');

        if (licenseType.toLowerCase().startsWith('pro')) {
            // return license if pro/plus
            console.log(`Returning ${licenseType} Unity License`);

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
            // -quit -batchmode -returnlicense -username name@example.com -password XXXXXXXXXXXXX
            var args = `quit -batchmode -returnlicense -username ${username} -password ${password}`;
            await exec.exec(`"${pwsh}" -Command`, `${unity_action} -editorPath "${editorPath}" -additionalArgs "${args}" -logName ReturnLicense`);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();