const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

const main = async () => {
    try {
        var licenseType = core.getInput('license-type');

        if(licenseType.toLowerCase().startsWith('pro')) {
            // return license if pro/plus
            console.log(`Returning ${licenseType} Unity License`);
            console.log('-quit -batchmode -returnlicense -username name@example.com -password XXXXXXXXXXXXX');
            // -quit -batchmode -returnlicense -username name@example.com -password XXXXXXXXXXXXX
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();